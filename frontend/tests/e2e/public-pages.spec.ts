/**
 * 公共页面 E2E 测试 — 登录页、打印预览等无需认证的页面
 */
import { test, expect } from '@playwright/test';

test.describe('公开页面', () => {
  test('[E2E] 学生登录页加载完整', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 验证登录表单存在
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // 应包含手机号或用户名输入区域
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThan(0);
  });

  test('[E2E] 管理员登录页加载', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');

    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('[E2E] 家长登录页加载', async ({ page }) => {
    await page.goto('/parent/login');
    await page.waitForLoadState('networkidle');

    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('[E2E] 未登录访问 /dashboard 重定向到 /login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url).toContain('/login');
  });

  test('[E2E] 未登录访问受保护页面统一重定向', async ({ page }) => {
    const protectedPages = [
      '/questions',
      '/papers',
      '/my-papers',
      '/profile',
      '/self-study',
    ];

    for (const path of protectedPages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const url = page.url();
      expect(url, `${path} 应重定向到 /login`).toContain('/login');
      // 清除 localStorage 避免 token 残留影响后续测试
      await page.evaluate(() => localStorage.clear());
    }
  });

  test('[E2E] 打印预览页无需认证', async ({ page }) => {
    // 打印预览可能不直接可用，验证路由存在且不重定向
    await page.goto('/print-preview');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    // 不应被重定向到登录页
    expect(url).not.toContain('/login');
  });
});

test.describe('前端加载性能', () => {
  test('[PERF] 登录页 LCP < 5秒', async ({ page }) => {
    const start = Date.now();
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - start;

    // LCP (加载完成) < 5s
    expect(loadTime).toBeLessThan(5000);
  });

  test('[PERF] 无 JS 运行时错误', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 导航到多个页面检测错误
    const pages = ['/admin/login', '/parent/login'];

    for (const path of pages) {
      await page.evaluate(() => localStorage.clear());
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }

    // 不应有未捕获的 JS 错误
    expect(errors).toEqual([]);
  });
});
