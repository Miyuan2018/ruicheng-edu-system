import type { AxiosError } from 'axios';

/** 从 API 错误响应中提取可读的错误信息 */
export function extractApiError(err: unknown, fallback: string): string {
  const e = err as AxiosError<{ message?: unknown; detail?: unknown; code?: number }>;
  if (!e?.response) {
    // 网络错误 / 超时
    const msg = (err as Error)?.message || '';
    if (msg.includes('Network Error')) return '网络连接失败，请检查服务是否启动';
    if (msg.includes('timeout')) return '请求超时，请稍后重试';
    return fallback;
  }

  const body = e.response.data;
  if (!body || typeof body !== 'object') return fallback;

  // 后端 ApiResponseMiddleware 包装的错误: {code, message, detail, data}
  const msg = body.message;
  if (typeof msg === 'string' && msg.length > 0) return msg;

  // FastAPI 原生 422 校验错误: {detail: [{loc, msg, type}]}
  const detail = body.detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d: { msg?: string }) => d.msg || '').filter(Boolean).join('; ');
  }
  if (typeof detail === 'string' && detail.length > 0) return detail;

  // HTTP 状态码兜底
  if (e.response.status === 500) return '服务器内部错误，请查看后端日志';
  if (e.response.status === 422) return '提交数据格式有误，请检查输入';
  if (e.response.status === 404) return '请求的资源不存在';
  if (e.response.status === 403) return '没有操作权限';

  return fallback;
}
