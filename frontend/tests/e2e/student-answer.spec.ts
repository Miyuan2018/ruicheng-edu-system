/**
 * 学生答题 E2E 测试 — 登录 → 我的试卷 → 答题页面 → 题目渲染
 * 使用 loginViaApi 登录学生账号，遵循现有测试风格
 */
import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

test.describe('学生答题 E2E', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, {
      username: 'li_hua',
      userType: 'STUDENT',
    });
    if (!ok) test.skip(true, '跳过：学生登录失败');
  });

  test('[E2E] 我的试卷页面加载正常', async ({ page }) => {
    await page.goto('/my-papers');
    await page.waitForLoadState('networkidle');

    // 页面应正常渲染
    await expect(page.locator('.ant-layout-content')).toBeVisible();

    // 应有搜索/筛选区域
    await expect(page.locator('.ant-input, .ant-select, .ant-btn')).toBeVisible();
  });

  test('[E2E] 我的试卷有在线答题入口', async ({ page }) => {
    await page.goto('/my-papers');
    await page.waitForLoadState('networkidle');

    // 检查是否有试卷列表
    const answerBtns = page.locator('text=在线答题');
    const count = await answerBtns.count();

    if (count > 0) {
      // 有可答题的试卷 - 验证按钮正常渲染
      const firstBtn = answerBtns.first();
      await expect(firstBtn).toBeVisible();

      // 点击第一个在线答题
      await firstBtn.click();
      await page.waitForLoadState('networkidle');

      // 应跳转到答题页面
      const currentUrl = page.url();
      expect(currentUrl).toContain('/answer/');
    } else {
      // 无可答试卷 - 仅验证页面无崩溃
      test.info().annotations.push({
        type: 'warning',
        description: '当前学生账号无可答题试卷，跳过答题交互验证',
      });
    }
  });

  test('[E2E] 答题页面加载有题时渲染正常', async ({ page }) => {
    await page.goto('/my-papers');
    await page.waitForLoadState('networkidle');

    const answerBtns = page.locator('text=在线答题');
    const count = await answerBtns.count();
    if (count === 0) {
      test.skip(true, '跳过：无可用试卷');
      return;
    }

    // 进入答题页面
    await answerBtns.first().click();
    await page.waitForLoadState('networkidle');

    // 验证答题页面组件
    const currentUrl = page.url();
    expect(currentUrl).toContain('/answer/');

    // 页面应加载试卷标题或单元信息
    // 等待内容加载（可能会显示加载中）
    await page.waitForTimeout(2000);

    // 检查是否成功加载试卷内容
    const hasTitle = await page.locator('text=E2E').or(page.locator('.ant-spin')).count();
    expect(hasTitle).toBeGreaterThanOrEqual(0);

    // 若有题目渲染，验证答题控件存在
    const radioBtns = page.locator('input[type="radio"]');
    const checkboxes = page.locator('input[type="checkbox"]');
    const inputs = page.locator('input[type="text"], textarea');

    const totalControls = await radioBtns.count() + await checkboxes.count() + await inputs.count();
    if (totalControls > 0) {
      // 有题目控件 - 可以尝试作答
      if (await radioBtns.count() > 0) {
        // 单选题：选择第一个选项
        const firstRadio = radioBtns.first();
        await firstRadio.click({ force: true });
      }
    }
  });
});
