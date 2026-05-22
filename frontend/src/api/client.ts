import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    // 自动解包后端 ApiResponseMiddleware 的 {code, message, data} 格式
    var body = response.data;
    if (body && typeof body === 'object' && 'code' in body && 'data' in body) {
      response.data = body.data;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const resp = await axios.post('/api/v1/auth/refresh', null, {
            params: { refresh_token: refreshToken },
          });
          // 同样处理 ApiResponseMiddleware 的 {code, message, data} 包裹
          var body = resp.data;
          var tokenData = (body && body.data) ? body.data : body;
          localStorage.setItem('access_token', tokenData.access_token);
          localStorage.setItem('refresh_token', tokenData.refresh_token);
          originalRequest.headers.Authorization = `Bearer ${tokenData.access_token}`;
          return apiClient(originalRequest);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
