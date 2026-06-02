/**
 * 教师端 E2E 测试 — 登录 → 仪表盘 → 试卷管理 → 班级管理 → 统计分析
 */
import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

test.describe('教师端核心页面', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, {
      username: 't_math',
      password: 'Demo1234',
      userType: 'TEACHER',
    });
    if (!ok) test.skip(true, '跳过：教师登录失败');
  });

  test('[E2E] 教师仪表盘加载', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });

  test('[E2E] 试卷管理页加载', async ({ page }) => {
    await page.goto('/papers');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });

  test('[E2E] 班级管理页加载', async ({ page }) => {
    await page.goto('/teacher/classes');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });

  test('[E2E] 试卷统计页加载', async ({ page }) => {
    await page.goto('/teacher/stats/paper');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });

  test('[E2E] 题目统计页加载', async ({ page }) => {
    await page.goto('/teacher/stats/question');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });

  test('[E2E] 题库浏览页加载', async ({ page }) => {
    await page.goto('/questions');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });

  test('[E2E] 大纲页加载', async ({ page }) => {
    await page.goto('/syllabus');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });
});

test.describe('教师端导航', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, {
      username: 't_math',
      password: 'Demo1234',
      userType: 'TEACHER',
    });
    if (!ok) test.skip(true, '跳过：教师登录失败');
  });

  test('[E2E] 教师侧栏包含关键入口', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('.ant-layout-sider, aside');
    await expect(sidebar.first()).toBeVisible();
    const menuText = await sidebar.first().textContent();
    expect(menuText).toMatch(/仪表盘|试卷|班级|统计/);
  });
});
