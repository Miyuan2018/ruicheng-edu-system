import axios from 'axios';
import { getAccessToken, getRefreshToken } from '../store/auth';

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    // 自动解包后端 ApiResponseMiddleware 的 {code, message, data} 格式
    const body = response.data;
    if (body && typeof body === 'object' && 'code' in body && 'data' in body) {
      response.data = body.data;
    }
    return response;
  },
  async (error) => {
    // 提取真正的错误消息：后端 ApiResponseMiddleware 包装了 {code,message,detail,data}
    if (error.response?.data) {
      const body = error.response.data;
      if (typeof body === 'object' && 'message' in body) {
        const msg = body.message;
        // FastAPI 422 验证错误返回列表 [{"msg":"...","loc":[...]}]
        if (Array.isArray(msg)) {
          error.response.data = {
            detail: msg.map((e: any) =>
              `${e.loc?.join('.') || ''}: ${e.msg}`
            ).join('; '),
          };
        } else if (typeof msg === 'string' && msg !== 'Internal Server Error') {
          error.response.data = { detail: msg };
        }
      }
      // 兜底：把整个响应体 JSON 序列化作为错误消息
      if (!error.response.data?.detail || error.response.data?.detail === '') {
        try {
          error.response.data = { detail: JSON.stringify(body) };
        } catch {}
      }
    }

    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const resp = await axios.post('/api/v1/auth/refresh', null, {
            params: { refresh_token: refreshToken },
          });
          // 同样处理 ApiResponseMiddleware 的 {code, message, data} 包裹
          const body = resp.data;
          const tokenData = (body && body.data) ? body.data : body;
          localStorage.setItem('access_token', tokenData.access_token);
          localStorage.setItem('refresh_token', tokenData.refresh_token);
          originalRequest.headers.Authorization = `Bearer ${tokenData.access_token}`;
          return apiClient(originalRequest);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          // 根据当前路径决定跳转到哪个登录页
          const isAdmin = window.location.pathname.startsWith('/admin') ||
            window.location.pathname.startsWith('/dashboard') ||
            window.location.pathname.startsWith('/question-admin') ||
            window.location.pathname.startsWith('/teacher');
          window.location.href = isAdmin ? '/admin/login' : '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
