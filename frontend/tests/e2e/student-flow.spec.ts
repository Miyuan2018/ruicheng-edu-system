/**
 * 学生端 E2E 测试 — 登录 → 仪表盘 → 试题讲解 → 我的试卷
 */
import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

test.describe('学生端核心页面', () => {
  test.beforeEach(async ({ context, page }) => {
    // 使用 demo 数据中的学生账号
    const ok = await loginViaApi(context, page, {
      username: 'li_hua',
      userType: 'STUDENT',
    });
    if (!ok) {
      test.skip(true, '跳过 API 登录：无可用的测试学生账号');
    }
  });

  test('[E2E] 学生仪表盘加载完整', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 页面标题或侧栏应包含关键文字
    // 验证页面正常渲染（无白屏）
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Dashboard 内容应可见
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });

  test('[E2E] 试题讲解页加载', async ({ page }) => {
    await page.goto('/typical-questions');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });

  test('[E2E] 我的试卷页加载', async ({ page }) => {
    await page.goto('/my-papers');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });

  test('[E2E] 错题本页加载', async ({ page }) => {
    await page.goto('/mistake-book');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    // 错题本页面: 页面可能显示空状态(无错题数据)或列表, 不强制检查特定容器
    const headingOrTable = page.locator('h1, h2, h3, h4, .ant-table, .ant-empty, .ant-result');
    await expect(headingOrTable.first()).toBeVisible({ timeout: 5000 });
  });

  test('[E2E] 自学任务页加载', async ({ page }) => {
    await page.goto('/self-study');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });

  test('[E2E] 个人资料页加载', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });
});

test.describe('学生端导航', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, {
      username: 'li_hua',
      userType: 'STUDENT',
    });
    if (!ok) test.skip(true, '跳过：学生登录失败');
  });

  test('[E2E] 侧栏菜单存在关键入口', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 检查侧栏菜单项
    const sidebar = page.locator('.ant-layout-sider, aside');
    await expect(sidebar.first()).toBeVisible();

    // 侧栏应包含关键导航项文字
    const menuText = await sidebar.first().textContent();
    expect(menuText).toMatch(/仪表盘|试卷|错题|讲解|自学/);
  });

  test('[E2E] 登录页 → 重定向到仪表盘', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 已登录状态应被重定向到 /dashboard
    const url = page.url();
    expect(url).toContain('/dashboard');
  });
});
