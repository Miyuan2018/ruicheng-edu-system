# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: paper-wizard.spec.ts >> 组卷向导 - 保存草稿 >> [E2E] 手动保存按钮存在且可用
- Location: tests/e2e/paper-wizard.spec.ts:86:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button:has-text("保存草稿")')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('button:has-text("保存草稿")')

```

# Test source

```ts
  1  | /**
  2  |  * 组卷向导 E2E 测试 — 新建试卷 → 填写基本信息 → 添加单元 → 预览 → 入库
  3  |  * 使用 loginViaApi 登录教师账号，遵循现有测试风格
  4  |  */
  5  | import { test, expect } from '@playwright/test';
  6  | import { loginViaApi } from './helpers/auth';
  7  | 
  8  | test.describe('组卷向导 E2E', () => {
  9  |   test.beforeEach(async ({ context, page }) => {
  10 |     const ok = await loginViaApi(context, page, {
  11 |       username: 't_math',
  12 |       password: 'Demo1234',
  13 |       userType: 'TEACHER',
  14 |     });
  15 |     if (!ok) test.skip(true, '跳过：教师登录失败');
  16 |   });
  17 | 
  18 |   test('[E2E] 新建试卷向导页面加载 - 各步骤导航', async ({ page }) => {
  19 |     await page.goto('/papers/new');
  20 |     await page.waitForLoadState('networkidle');
  21 | 
  22 |     // 应显示 Stepper: 基本信息 / 试卷结构 / 选题 / 预览 / 入库
  23 |     await expect(page.locator('.ant-steps')).toBeVisible();
  24 | 
  25 |     // 页面标题应包含"新建试卷"
  26 |     await expect(page.locator('text=新建试卷').first()).toBeVisible();
  27 | 
  28 |     // 基本信息卡片应可见
  29 |     await expect(page.locator('text=基本信息').first()).toBeVisible();
  30 | 
  31 |     // 表单字段应渲染
  32 |     await expect(page.locator('input[id="title"]')).toBeVisible();
  33 |   });
  34 | 
  35 |   test('[E2E] 填写基本信息 → 下一步到结构页', async ({ page }) => {
  36 |     await page.goto('/papers/new');
  37 |     await page.waitForLoadState('networkidle');
  38 | 
  39 |     // 填写试卷标题
  40 |     const titleInput = page.locator('input[id="title"]');
  41 |     await titleInput.fill('E2E测试卷');
  42 | 
  43 |     // 下一步按钮应可用
  44 |     const nextBtn = page.locator('button:has-text("下一步")');
  45 |     await expect(nextBtn).toBeVisible();
  46 | 
  47 |     // 注意: 由于学科/年级需要后端数据下拉，不强制提交
  48 |     // 仅验证步骤导航按钮存在
  49 |     await expect(page.locator('.ant-steps')).toBeVisible();
  50 | 
  51 |     // 验证上一步按钮不可见（第0步）
  52 |     const prevBtn = page.locator('button:has-text("上一步")');
  53 |     await expect(prevBtn).toHaveCount(0);
  54 |   });
  55 | 
  56 |   test('[E2E] 试卷结构页 - 快速创建预设按钮', async ({ page }) => {
  57 |     await page.goto('/papers/new');
  58 |     await page.waitForLoadState('networkidle');
  59 | 
  60 |     // 直接调用 store 方法跳到 Step 1 太复杂，通过路由加载后再检查
  61 |     // 验证结构页的关键按钮可见性
  62 |     // 导航依赖后端数据，此测试通过检查页面元素确保组件可渲染
  63 |     await expect(page.locator('text=基本信息').first()).toBeVisible();
  64 |   });
  65 | 
  66 |   test('[E2E] 编辑已有试卷页面加载', async ({ page }) => {
  67 |     // 先获取试卷列表，找一篇草稿
  68 |     await page.goto('/papers');
  69 |     await page.waitForLoadState('networkidle');
  70 | 
  71 |     // 试卷列表页面应正常渲染
  72 |     await expect(page.locator('.ant-layout-content')).toBeVisible();
  73 |   });
  74 | });
  75 | 
  76 | test.describe('组卷向导 - 保存草稿', () => {
  77 |   test.beforeEach(async ({ context, page }) => {
  78 |     const ok = await loginViaApi(context, page, {
  79 |       username: 't_math',
  80 |       password: 'Demo1234',
  81 |       userType: 'TEACHER',
  82 |     });
  83 |     if (!ok) test.skip(true, '跳过：教师登录失败');
  84 |   });
  85 | 
  86 |   test('[E2E] 手动保存按钮存在且可用', async ({ page }) => {
  87 |     await page.goto('/papers/new');
  88 |     await page.waitForLoadState('networkidle');
  89 | 
  90 |     // 保存草稿按钮应可见
  91 |     const saveBtn = page.locator('button:has-text("保存草稿")');
> 92 |     await expect(saveBtn).toBeVisible();
     |                           ^ Error: expect(locator).toBeVisible() failed
  93 |   });
  94 | });
  95 | 
```