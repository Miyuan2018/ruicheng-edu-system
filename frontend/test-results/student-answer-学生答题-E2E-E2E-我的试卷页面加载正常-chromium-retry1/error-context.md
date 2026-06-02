# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: student-answer.spec.ts >> 学生答题 E2E >> [E2E] 我的试卷页面加载正常
- Location: tests/e2e/student-answer.spec.ts:17:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.ant-layout-content')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('.ant-layout-content')

```

# Test source

```ts
  1   | /**
  2   |  * 学生答题 E2E 测试 — 登录 → 我的试卷 → 答题页面 → 题目渲染
  3   |  * 使用 loginViaApi 登录学生账号，遵循现有测试风格
  4   |  */
  5   | import { test, expect } from '@playwright/test';
  6   | import { loginViaApi } from './helpers/auth';
  7   | 
  8   | test.describe('学生答题 E2E', () => {
  9   |   test.beforeEach(async ({ context, page }) => {
  10  |     const ok = await loginViaApi(context, page, {
  11  |       username: 'li_hua',
  12  |       userType: 'STUDENT',
  13  |     });
  14  |     if (!ok) test.skip(true, '跳过：学生登录失败');
  15  |   });
  16  | 
  17  |   test('[E2E] 我的试卷页面加载正常', async ({ page }) => {
  18  |     await page.goto('/my-papers');
  19  |     await page.waitForLoadState('networkidle');
  20  | 
  21  |     // 页面应正常渲染
> 22  |     await expect(page.locator('.ant-layout-content')).toBeVisible();
      |                                                       ^ Error: expect(locator).toBeVisible() failed
  23  | 
  24  |     // 应有搜索/筛选区域
  25  |     await expect(page.locator('.ant-input, .ant-select, .ant-btn')).toBeVisible();
  26  |   });
  27  | 
  28  |   test('[E2E] 我的试卷有在线答题入口', async ({ page }) => {
  29  |     await page.goto('/my-papers');
  30  |     await page.waitForLoadState('networkidle');
  31  | 
  32  |     // 检查是否有试卷列表
  33  |     const answerBtns = page.locator('text=在线答题');
  34  |     const count = await answerBtns.count();
  35  | 
  36  |     if (count > 0) {
  37  |       // 有可答题的试卷 - 验证按钮正常渲染
  38  |       const firstBtn = answerBtns.first();
  39  |       await expect(firstBtn).toBeVisible();
  40  | 
  41  |       // 点击第一个在线答题
  42  |       await firstBtn.click();
  43  |       await page.waitForLoadState('networkidle');
  44  | 
  45  |       // 应跳转到答题页面
  46  |       const currentUrl = page.url();
  47  |       expect(currentUrl).toContain('/answer/');
  48  |     } else {
  49  |       // 无可答试卷 - 仅验证页面无崩溃
  50  |       test.info().annotations.push({
  51  |         type: 'warning',
  52  |         description: '当前学生账号无可答题试卷，跳过答题交互验证',
  53  |       });
  54  |     }
  55  |   });
  56  | 
  57  |   test('[E2E] 答题页面加载有题时渲染正常', async ({ page }) => {
  58  |     await page.goto('/my-papers');
  59  |     await page.waitForLoadState('networkidle');
  60  | 
  61  |     const answerBtns = page.locator('text=在线答题');
  62  |     const count = await answerBtns.count();
  63  |     if (count === 0) {
  64  |       test.skip(true, '跳过：无可用试卷');
  65  |       return;
  66  |     }
  67  | 
  68  |     // 进入答题页面
  69  |     await answerBtns.first().click();
  70  |     await page.waitForLoadState('networkidle');
  71  | 
  72  |     // 验证答题页面组件
  73  |     const currentUrl = page.url();
  74  |     expect(currentUrl).toContain('/answer/');
  75  | 
  76  |     // 页面应加载试卷标题或单元信息
  77  |     // 等待内容加载（可能会显示加载中）
  78  |     await page.waitForTimeout(2000);
  79  | 
  80  |     // 检查是否成功加载试卷内容
  81  |     const hasTitle = await page.locator('text=E2E').or(page.locator('.ant-spin')).count();
  82  |     expect(hasTitle).toBeGreaterThanOrEqual(0);
  83  | 
  84  |     // 若有题目渲染，验证答题控件存在
  85  |     const radioBtns = page.locator('input[type="radio"]');
  86  |     const checkboxes = page.locator('input[type="checkbox"]');
  87  |     const inputs = page.locator('input[type="text"], textarea');
  88  | 
  89  |     const totalControls = await radioBtns.count() + await checkboxes.count() + await inputs.count();
  90  |     if (totalControls > 0) {
  91  |       // 有题目控件 - 可以尝试作答
  92  |       if (await radioBtns.count() > 0) {
  93  |         // 单选题：选择第一个选项
  94  |         const firstRadio = radioBtns.first();
  95  |         await firstRadio.click({ force: true });
  96  |       }
  97  |     }
  98  |   });
  99  | });
  100 | 
```