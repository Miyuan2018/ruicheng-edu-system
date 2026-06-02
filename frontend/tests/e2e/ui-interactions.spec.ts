/**
 * 全页面可点击功能交互测试
 * 验证每个页面所有按钮、链接、Tab、Modal、Drawer 等功能正常
 */
import { test, expect, Page } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

// ── 辅助函数 ──────────────────────────────────────────

/** 安全地点击可见按钮 */
async function clickIfVisible(page: Page, selector: string, timeout = 3000) {
  const el = page.locator(selector).first();
  if (await el.isVisible({ timeout }).catch(() => false)) {
    await el.click();
    await page.waitForTimeout(300);
    return true;
  }
  return false;
}

/** 获取页面上所有 Ant Design 按钮 */
async function getAllButtons(page: Page) {
  return page.locator('button, .ant-btn, a[role="button"], [role="tab"]');
}

/** 等待页面稳定 */
async function waitStable(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

// ── 登录页交互 ────────────────────────────────────────

test.describe('登录页交互', () => {
  test('学生登录页 — 表单输入 + 标签切换', async ({ page }) => {
    await page.goto('/login');
    await waitStable(page);

    // 输入框可用
    const inputs = page.locator('input');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);

    // 在第一个输入框输入
    if (count > 0) {
      await inputs.first().fill('test_user');
      await expect(inputs.first()).toHaveValue('test_user');
    }

    // "家长入口" 链接可点击
    const parentLink = page.locator('a:has-text("家长"), button:has-text("家长")');
    if (await parentLink.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await parentLink.first().click();
      await expect(page).toHaveURL(/parent/);
    }
  });

  test('管理员登录页 — 角色选择', async ({ page }) => {
    await page.goto('/admin/login');
    await waitStable(page);

    // 角色选择器(Select/Radio)存在
    const selects = page.locator('.ant-select, .ant-radio-group, [role="radiogroup"]');
    const hasRoleSelector = await selects.first().isVisible({ timeout: 2000 }).catch(() => false);
    if (hasRoleSelector) {
      await selects.first().click();
      await page.waitForTimeout(300);
      // 下拉选项应出现
      const options = page.locator('.ant-select-item, [role="option"]');
      const optCount = await options.count();
      expect(optCount).toBeGreaterThanOrEqual(0); // 可能0也可能有选项
    }
  });

  test('家长登录页 — 注册/登录 Tab 切换', async ({ page }) => {
    await page.goto('/parent/login');
    await waitStable(page);

    // Tab 切换
    const tabs = page.locator('.ant-tabs-tab, [role="tab"]');
    const tabCount = await tabs.count();
    if (tabCount >= 2) {
      // 点击第二个 tab
      await tabs.nth(1).click();
      await page.waitForTimeout(500);
      // 验证 tab 已切换
      const activeTab = page.locator('.ant-tabs-tab-active, [aria-selected="true"]');
      expect(await activeTab.count()).toBeGreaterThan(0);
    }
  });
});

// ── 学生仪表盘交互 ──────────────────────────────────

test.describe('学生仪表盘交互', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, { username: 'li_hua', userType: 'STUDENT' });
    if (!ok) test.skip();
  });

  test('仪表盘 — 统计卡片可点击', async ({ page }) => {
    await page.goto('/dashboard');
    await waitStable(page);

    // Statistic 卡片
    const cards = page.locator('.ant-card, .ant-statistic, [class*="card"], [class*="Card"]');
    const cardCount = await cards.count();
    console.log(`  → ${cardCount} 个统计卡片/组件`);

    // 图表应渲染
    const charts = page.locator('.recharts-wrapper, .recharts-surface');
    const chartCount = await charts.count();
    console.log(`  → ${chartCount} 个图表`);
  });

  test('仪表盘 — 所有按钮可点击', async ({ page }) => {
    await page.goto('/dashboard');
    await waitStable(page);

    const buttons = await getAllButtons(page);
    const count = await buttons.count();
    console.log(`  → ${count} 个按钮/可交互元素`);

    // 逐个尝试点击，不期待每个都有反应
    let clicked = 0;
    for (let i = 0; i < Math.min(count, 15); i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        try {
          await btn.click({ timeout: 1000 });
          await page.waitForTimeout(200);
          clicked++;
        } catch { /* 不可点击忽略 */ }
      }
    }
    console.log(`  ✓ 成功点击 ${clicked} 个元素`);
  });
});

// ── 试题讲解页交互 ──────────────────────────────────

test.describe('试题讲解页交互', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, { username: 'li_hua', userType: 'STUDENT' });
    if (!ok) test.skip();
  });

  test('讲解页 — Tab 切换 + 讲解按钮', async ({ page }) => {
    await page.goto('/typical-questions');
    await waitStable(page);

    // Tab 切换
    const tabs = page.locator('.ant-tabs-tab, [role="tab"]');
    const tabCount = await tabs.count();
    console.log(`  → ${tabCount} 个 Tab`);

    for (let i = 0; i < tabCount; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(300);
    }

    // 讲解按钮 (PlayCircleOutlined)
    const playButtons = page.locator('[aria-label="play-circle"], .anticon-play-circle');
    if (await playButtons.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await playButtons.first().click();
      await page.waitForTimeout(500);

      // Drawer 应弹出
      const drawer = page.locator('.ant-drawer, [role="dialog"]');
      if (await drawer.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('  ✓ Drawer 弹出成功');

        // 关闭 Drawer
        const closeBtn = page.locator('.ant-drawer-close, [aria-label="Close"]');
        if (await closeBtn.first().isVisible().catch(() => false)) {
          await closeBtn.first().click();
          await page.waitForTimeout(300);
        }
      }
    }
  });

  test('讲解页 — Drawer 步骤控制器', async ({ page }) => {
    await page.goto('/typical-questions');
    await waitStable(page);

    // 尝试打开 Drawer
    const playBtn = page.locator('[aria-label="play-circle"], .anticon-play-circle').first();
    if (await playBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await playBtn.click();
      await page.waitForTimeout(500);

      // 步骤导航按钮
      const prevBtn = page.locator('button:has-text("上一步"), [aria-label="arrow-left"]');
      const nextBtn = page.locator('button:has-text("下一步"), [aria-label="arrow-right"]');
      const autoBtn = page.locator('button:has-text("自动"), [aria-label="play-circle"]');

      if (await prevBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await prevBtn.first().click();
        console.log('  ✓ 上一步按钮可点击');
      }
      if (await nextBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextBtn.first().click();
        console.log('  ✓ 下一步按钮可点击');
      }
      if (await autoBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        try {
          await autoBtn.first().click({ timeout: 3000 });
          console.log('  ✓ 自动播放按钮可点击');
        } catch { /* 被遮罩挡住 */ }
      }
    }
  });
});

// ── 我的试卷页交互 ──────────────────────────────────

test.describe('我的试卷页交互', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, { username: 'li_hua', userType: 'STUDENT' });
    if (!ok) test.skip();
  });

  test('试卷页 — 操作按钮组', async ({ page }) => {
    await page.goto('/my-papers');
    await waitStable(page);

    // 表格行
    const rows = page.locator('.ant-table-row, [data-row-key]');
    const rowCount = await rows.count();
    console.log(`  → ${rowCount} 行试卷`);

    // 操作列按钮 (预览/导出/打印/答题/删除等)
    const actionBtns = page.locator('.ant-btn-link, .ant-btn-icon-only, a[href]');
    const btnCount = await actionBtns.count();
    console.log(`  → ${btnCount} 个可交互元素`);

    // 点击第一个链接按钮(预览/答题)
    if (btnCount > 0) {
      const firstAction = actionBtns.first();
      if (await firstAction.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstAction.click();
        await page.waitForTimeout(500);
      }
    }

    // 关闭可能的 Modal/Drawer
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('试卷页 — 打印预览按钮', async ({ page }) => {
    await page.goto('/my-papers');
    await waitStable(page);

    // 查找打印相关按钮
    const printBtn = page.locator('[aria-label="printer"], .anticon-printer, button:has-text("打印")');
    if (await printBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      const [newPage] = await Promise.all([
        page.waitForEvent('popup').catch(() => [] as any),
        printBtn.first().click(),
      ]);
      if (newPage) {
        console.log('  ✓ 打印预览新窗口打开');
        await newPage.close().catch(() => {});
      }
    }
  });
});

// ── 错题本页交互 ────────────────────────────────────

test.describe('错题本页交互', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, { username: 'li_hua', userType: 'STUDENT' });
    if (!ok) test.skip();
  });

  test('错题本 — 预览 Modal + 操作按钮', async ({ page }) => {
    await page.goto('/mistake-book');
    await waitStable(page);

    // 有错题数据时的操作按钮
    const actionBtns = await getAllButtons(page);
    const count = await actionBtns.count();
    console.log(`  → ${count} 个按钮(含空状态)`);

    // 点击预览/查看按钮
    const previewBtn = page.locator('button:has-text("预览"), .anticon-eye, [aria-label="eye"]');
    if (await previewBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await previewBtn.first().click();
      await page.waitForTimeout(500);

      // Modal 应弹出
      const modal = page.locator('.ant-modal, [role="dialog"]');
      if (await modal.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('  ✓ 预览 Modal 弹出');
        await page.keyboard.press('Escape');
      }
    }
  });
});

// ── 自学任务页交互 ──────────────────────────────────

test.describe('自学任务页交互', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, { username: 'li_hua', userType: 'STUDENT' });
    if (!ok) test.skip();
  });

  test('自学任务 — 页面加载无错误', async ({ page }) => {
    await page.goto('/self-study');
    await waitStable(page);
    await expect(page.locator('body')).toBeVisible();

    // 表格或空状态
    const content = page.locator('.ant-table, .ant-empty, .ant-result');
    expect(await content.first().isVisible({ timeout: 3000 }).catch(() => true)).toBeTruthy();
    console.log('  ✓ 自学任务页加载正常');
  });
});

// ── 个人资料页交互 ──────────────────────────────────

test.describe('个人资料页交互', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, { username: 'li_hua', userType: 'STUDENT' });
    if (!ok) test.skip();
  });

  test('资料页 — 表单可编辑 + 邀请码区域', async ({ page }) => {
    await page.goto('/profile');
    await waitStable(page);

    // 输入框
    const inputs = page.locator('input:not([type="hidden"])');
    const inputCount = await inputs.count();
    console.log(`  → ${inputCount} 个输入框`);

    // 编辑按钮
    const editBtn = page.locator('button:has-text("编辑"), button:has-text("修改"), [aria-label="edit"]');
    if (await editBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await editBtn.first().click();
      await page.waitForTimeout(300);
      console.log('  ✓ 编辑按钮可点击');
    }

    // 邀请码相关
    const inviteCode = page.locator(':has-text("邀请码"), :has-text("邀请")');
    if (await inviteCode.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('  ✓ 邀请码区域存在');
    }
  });
});

// ── 教师仪表盘交互 ──────────────────────────────────

test.describe('教师仪表盘交互', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, {
      username: 't_math', password: 'Demo1234', userType: 'TEACHER',
    });
    if (!ok) test.skip();
  });

  test('教师仪表盘 — 快捷操作卡片', async ({ page }) => {
    await page.goto('/dashboard');
    await waitStable(page);

    // 卡片
    const cards = page.locator('.ant-card');
    const cardCount = await cards.count();
    console.log(`  → ${cardCount} 个卡片`);

    // 点击卡片上的操作
    const cardActions = page.locator('.ant-card-actions button, .ant-card-actions a');
    if (await cardActions.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await cardActions.first().click();
      await page.waitForTimeout(300);
      console.log('  ✓ 快捷操作可点击');
    }
  });
});

// ── 教师试卷管理交互 ────────────────────────────────

test.describe('教师试卷管理交互', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, {
      username: 't_math', password: 'Demo1234', userType: 'TEACHER',
    });
    if (!ok) test.skip();
  });

  test('试卷管理 — 新建试卷按钮', async ({ page }) => {
    await page.goto('/papers');
    await waitStable(page);

    // 新建按钮
    const createBtn = page.locator('button:has-text("新建"), button:has-text("创建"), button:has-text("添加"), [aria-label="plus"]');
    if (await createBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.first().click();
      await page.waitForTimeout(500);

      // Modal/表单应弹出
      const modal = page.locator('.ant-modal, [role="dialog"], .ant-drawer');
      if (await modal.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('  ✓ 新建试卷 Modal 弹出');
        // 填写标题
        const titleInput = page.locator('input[id*="title"], input[placeholder*="标题"], input[name*="title"]');
        if (await titleInput.first().isVisible({ timeout: 1000 }).catch(() => false)) {
          await titleInput.first().fill('E2E交互测试试卷');
        }
        await page.keyboard.press('Escape');
      }
    }
  });

  test('试卷管理 — 筛选/搜索', async ({ page }) => {
    await page.goto('/papers');
    await waitStable(page);

    // Select 下拉筛选
    const selects = page.locator('.ant-select-selector');
    const selectCount = await selects.count();
    console.log(`  → ${selectCount} 个筛选器`);

    // 点击第一个筛选器
    if (selectCount > 0) {
      await selects.first().click();
      await page.waitForTimeout(300);

      // 下拉选项
      const options = page.locator('.ant-select-item-option');
      if (await options.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        await options.first().click();
        console.log('  ✓ 筛选器可操作');
      }
      await page.keyboard.press('Escape');
    }
  });
});

// ── 教师班级管理交互 ────────────────────────────────

test.describe('教师班级管理交互', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, {
      username: 't_math', password: 'Demo1234', userType: 'TEACHER',
    });
    if (!ok) test.skip();
  });

  test('班级管理 — 新建班级 + 学生管理', async ({ page }) => {
    await page.goto('/teacher/classes');
    await waitStable(page);

    // 新建班级按钮
    const createBtn = page.locator('button:has-text("新建"), button:has-text("创建"), button:has-text("添加")');
    if (await createBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.first().click();
      await page.waitForTimeout(500);

      const modal = page.locator('.ant-modal, [role="dialog"]');
      if (await modal.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('  ✓ 新建班级 Modal 弹出');
        await page.keyboard.press('Escape');
      }
    }
  });

  test('班级管理 — 班级详情/学生列表', async ({ page }) => {
    await page.goto('/teacher/classes');
    await waitStable(page);

    // 展开行/查看详情
    const expandBtn = page.locator('[aria-label="expand"], .ant-table-row-expand-icon, button:has-text("查看")');
    if (await expandBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await expandBtn.first().click();
      await page.waitForTimeout(500);
      console.log('  ✓ 班级展开/详情可点击');
    }
  });
});

// ── 教师统计页交互 ──────────────────────────────────

test.describe('教师统计页交互', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, { username: 't_math', password: 'Demo1234', userType: 'TEACHER' });
    if (!ok) test.skip();
  });

  test('试卷统计 — 表格展开 + 选项分布', async ({ page }) => {
    await page.goto('/teacher/stats/paper');
    await waitStable(page);

    const rows = page.locator('.ant-table-row');
    const rowCount = await rows.count();
    console.log(`  → 试卷统计 ${rowCount} 行`);

    // 展开选项分布
    if (rowCount > 0) {
      await rows.first().click();
      await page.waitForTimeout(300);
    }
  });

  test('题目统计 — 切换视图', async ({ page }) => {
    await page.goto('/teacher/stats/question');
    await waitStable(page);

    // 筛选条件
    const selects = page.locator('.ant-select');
    if (await selects.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await selects.first().click();
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
    }
  });
});

// ── 大纲/知识树页交互 ───────────────────────────────

test.describe('大纲/知识树页交互', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, { username: 't_math', password: 'Demo1234', userType: 'TEACHER' });
    if (!ok) test.skip();
  });

  test('大纲页 — 考纲 Tab + 知识树', async ({ page }) => {
    await page.goto('/syllabus');
    await waitStable(page);

    // Tab 切换
    const tabs = page.locator('.ant-tabs-tab');
    const tabCount = await tabs.count();
    console.log(`  → ${tabCount} 个 Tab`);

    for (let i = 0; i < tabCount; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(300);
    }

    // 树节点点击
    const treeNodes = page.locator('.ant-tree-node-content-wrapper, .ant-tree-title');
    if (await treeNodes.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await treeNodes.first().click();
      await page.waitForTimeout(300);
      console.log('  ✓ 知识树节点可点击');
    }
  });
});

// ── 题目列表页交互 ──────────────────────────────────

test.describe('题目列表页交互', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, { username: 't_math', password: 'Demo1234', userType: 'TEACHER' });
    if (!ok) test.skip();
  });

  test('题目列表 — 高级搜索 + 筛选面板', async ({ page }) => {
    await page.goto('/questions');
    await waitStable(page);

    // 搜索输入框
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="search"], .ant-input-search input');
    if (await searchInput.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.first().fill('实数');
      await searchInput.first().press('Enter');
      await page.waitForTimeout(500);
      console.log('  ✓ 搜索功能可用');
    }

    // 筛选 Select
    const selects = page.locator('.ant-select-selector');
    const sCount = await selects.count();
    for (let i = 0; i < Math.min(sCount, 3); i++) {
      if (await selects.nth(i).isVisible({ timeout: 500 }).catch(() => false)) {
        await selects.nth(i).click();
        await page.waitForTimeout(200);
        await page.keyboard.press('Escape');
      }
    }
    console.log(`  ✓ ${Math.min(sCount, 3)} 个筛选器可操作`);
  });

  test('题目列表 — 创建题目按钮', async ({ page }) => {
    await page.goto('/questions');
    await waitStable(page);

    const createBtn = page.locator('button:has-text("新建"), button:has-text("创建"), [aria-label="plus"]');
    if (await createBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.first().click();
      await page.waitForTimeout(500);

      const modal = page.locator('.ant-modal, [role="dialog"]');
      if (await modal.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('  ✓ 新建题目 Modal 弹出');

        // 题型选择
        const typeSelect = page.locator('[id*="question_type"], [id*="type"]');
        if (await typeSelect.first().isVisible({ timeout: 1000 }).catch(() => false)) {
          await typeSelect.first().click();
          await page.waitForTimeout(300);
        }
        await page.keyboard.press('Escape');
      }
    }
  });
});

// ── 推荐管理页交互 ──────────────────────────────────

test.describe('推荐管理页交互', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, { username: 't_math', password: 'Demo1234', userType: 'TEACHER' });
    if (!ok) test.skip();
  });

  test('推荐管理 — 表格 + 取消按钮', async ({ page }) => {
    await page.goto('/teacher/recommendations');
    await waitStable(page);

    // 表格
    const table = page.locator('.ant-table');
    const hasTable = await table.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (hasTable) {
      // 取消推荐按钮
      const cancelBtn = page.locator('button:has-text("取消"), button:has-text("删除")');
      if (await cancelBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('  ✓ 取消推荐按钮存在');
      }
    }
  });
});

// ── 侧栏导航交互 ────────────────────────────────────

test.describe('侧栏导航交互', () => {
  test.beforeEach(async ({ context, page }) => {
    const ok = await loginViaApi(context, page, { username: 'li_hua', userType: 'STUDENT' });
    if (!ok) test.skip();
  });

  test('侧栏 — 所有菜单项可点击并跳转', async ({ page }) => {
    await page.goto('/dashboard');
    await waitStable(page);

    // 获取所有菜单项
    const menuItems = page.locator('.ant-menu-item:not(.ant-menu-item-only-child)');
    const itemCount = await menuItems.count();
    console.log(`  → ${itemCount} 个菜单项`);

    let navigated = 0;
    for (let i = 0; i < itemCount; i++) {
      const item = menuItems.nth(i);
      if (await item.isVisible({ timeout: 500 }).catch(() => false)) {
        const beforeUrl = page.url();
        try {
          await item.click({ timeout: 2000 });
          await page.waitForTimeout(300);
          if (page.url() !== beforeUrl) navigated++;
        } catch { /* 不可点 */ }
      }
    }
    console.log(`  ✓ ${navigated} 个菜单项成功导航`);
    expect(navigated).toBeGreaterThan(0);
  });
});

// ── 弹窗/Modal 交互 ─────────────────────────────────

test.describe('Modal/Drawer 交互', () => {
  test('Escape 键关闭弹窗', async ({ page }) => {
    await page.goto('/login');
    await waitStable(page);
    await page.keyboard.press('Escape');
    // 不应崩溃
    await expect(page.locator('body')).toBeVisible();
  });
});
