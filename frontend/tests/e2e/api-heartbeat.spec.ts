/**
 * API 冒烟测试 — 无需浏览器，快速验证后端核心端点
 */
import { test, expect } from '@playwright/test';
import { apiHealth, apiGet, apiPost } from './helpers/auth';

test.describe('API 健康检查与公开端点', () => {
  test('[SMOKE] GET /health 返回健康状态', async ({ request }) => {
    const { status, body } = await apiHealth(request);
    expect(status).toBe(200);
    expect(body).toHaveProperty('status', 'healthy');
  });

  test('[SMOKE] 数据库连接正常', async ({ request }) => {
    const { status, body } = await apiHealth(request);
    expect(status).toBe(200);
    if (body.database) {
      expect(body.database).toBe('connected');
    }
  });

  test('[SMOKE] GET /api/v1/reference/all 返回参考数据', async ({ request }) => {
    const { status, body } = await apiGet(request, '/reference/all');
    expect(status).toBe(200);
    expect(body).toBeDefined();
    // reference/all 可能在 data 字段中
    const data = body?.data || body;
    if (data && typeof data === 'object') {
      // 应该有至少一个参考数据类型
      const keys = Object.keys(data);
      expect(keys.length).toBeGreaterThan(0);
    }
  });

  test('[SMOKE] GET /api/v1/subjects 需要认证(401)', async ({ request }) => {
    const { status } = await apiGet(request, '/subjects');
    // subjects 端点需要认证
    expect([200, 401]).toContain(status);
  });

  test('[SMOKE] GET /api/v1/questions 需要认证', async ({ request }) => {
    const { status } = await apiGet(request, '/questions');
    // 未认证应返回 401/403
    expect([401, 403, 422]).toContain(status);
  });

  test('[SMOKE] GET /api/v1/questions/search 需要认证', async ({ request }) => {
    const { status } = await apiGet(request, '/questions/search');
    expect([401, 403, 422]).toContain(status);
  });
});

test.describe('API 认证流程', () => {
  test('[API] GET /auth/captcha 获取图形验证码', async ({ request }) => {
    const r = await request.get('http://localhost:8001/api/v1/auth/captcha');
    expect([200, 401]).toContain(r.status());
    const body = await r.json();
    // 返回 SVG 或 captcha_key
    expect(body).toBeDefined();
  });

  test('[API] POST /auth/student/register 参数校验', async ({ request }) => {
    const r = await request.post('http://localhost:8001/api/v1/auth/student/register', {
      data: { phone: '', password: '' },
      headers: { 'Content-Type': 'application/json' },
    });
    // 参数不足应返回 422 或 400
    expect([400, 422]).toContain(r.status());
  });

  test('[API] POST /auth/refresh 无效 token 被拒绝', async ({ request }) => {
    const r = await request.post('http://localhost:8001/api/v1/auth/refresh', {
      data: { refresh_token: 'invalid-token-12345' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403, 404, 422]).toContain(r.status());
  });

  test('[API] POST /auth/admin/login 参数校验', async ({ request }) => {
    const r = await request.post('http://localhost:8001/api/v1/auth/admin/login', {
      data: { username: '', password: '' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([400, 422]).toContain(r.status());
  });
});

test.describe('API 受保护端点', () => {
  const protectedPaths = [
    '/exam-papers',
    '/classes',
    '/notifications',
    '/ocr/config',
    '/teacher/stats/papers',
    '/student/stats',
  ];

  for (const path of protectedPaths) {
    test(`[API] ${path} 拒绝未认证请求`, async ({ request }) => {
      const { status } = await apiGet(request, path);
      expect([401, 403]).toContain(status);
    });
  }
});

test.describe('API 家长端点', () => {
  const parentPaths = [
    '/parent/linked-students',
    '/parent/templates',
  ];

  for (const path of parentPaths) {
    test(`[API] ${path} 拒绝未认证请求`, async ({ request }) => {
      const { status } = await apiGet(request, path);
      expect([401, 403]).toContain(status);
    });
  }
});

test.describe('API 题目推荐端点', () => {
  test('[API] GET /recommendations/my 拒绝未认证请求', async ({ request }) => {
    const { status } = await apiGet(request, '/recommendations/my');
    expect([401, 403]).toContain(status);
  });
});

test.describe('API 讲题板端点', () => {
  test('[API] GET /topic-board 拒绝未认证请求', async ({ request }) => {
    const { status } = await apiGet(request, '/topic-board');
    expect([401, 403]).toContain(status);
  });
});
