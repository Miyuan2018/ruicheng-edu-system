# 前端组件开发计划

> **V1.0 状态**: ✅ 20个页面/组件已实现, 路由/状态管理/API层完整。
> V2.0: KaTeX公式编辑器 + Recharts图表 + OCR上传UI + 移动端适配。
> 详见 `docs/requirements-v2.0.md`

## 概述
本计划为edu_system项目的前端组件开发，基于React 18 + Ant Design（或Vue 3 + Naive UI）构建用户界面，涵盖用户管理、题目管理、试卷管理、在线作答、错题本等功能模块的组件设计。

## 1. 技术栈选择
- 主框架: React 18
- UI组件库: Ant Design 5.x
- 状态管理: Redux Toolkit 或 Zustand
- 路由管理: React Router v6
- 表单处理: React Hook Form 或 Ant Design Form
- 图表库: Recharts 或 Ant Design Charts
- 富文本编辑器: @ant-design/pro-components 或 Draft.js
- LaTeX公式支持: MathJax 或 KaTeX
- HTTP客户端: Axios 或 Fetch
- 构建工具: Vite 或 Create React App
- 类型检查: TypeScript

## 2. 目录结构
```
src/
├── assets/              # 静态资源（图片、图标等）
├── components/          # 通用组件
│   ├── layout/          # 布局组件（Header, Footer, Sidebar等）
│   ├── form/            # 表单相关组件
│   ├── data-display/    # 数据展示组件（Table, Card, List等）
│   ├── feedback/        # 反馈组件（Modal, Message, Notification等）
│   └── ui/              # 基础UI组件（Button, Input, Select等）
├── modules/             # 业务模块
│   ├── auth/            # 认证相关
│   ├── user/            # 用户管理
│   ├── question/        # 题目管理
│   ├── exam-paper/      # 试卷管理
│   ├── answer/          # 答案作答
│   ├── ocr/             # OCR功能
│   ├── grading/         # 判卷功能
│   ├── error-notebook/  # 错题本
│   └── self-study/      # 自学功能
├── hooks/               # 自定义Hooks
├── utils/               # 工具函数
├── services/            # API服务层
├── styles/              # 样式文件
├── routes/              # 路由配置
├── App.tsx              # 根组件
└── main.tsx             # 入口文件
```

## 3. 核心组件设计

### 3.1 布局组件 (Layout)
- **Header**: 顶部导航栏，包含Logo、用户信息、消息提醒等
- **Sidebar**: 侧边栏导航，支持折叠/展开
- **ContentWrapper**: 主内容区域包装器
- **Footer**: 底部信息栏
- **PageContainer**: 页面容器，包含面包屑导航

### 3.2 认证模块 (Auth)
- **LoginForm**: 登录表单，支持用户名/邮箱+密码登录
- **RegisterForm**: 注册表单，包含邮箱验证、密码强度检测
- **ResetPasswordForm**: 重置密码表单
- **ProfileDropdown**: 用户个人信息下拉菜列表
- **Avatar**: 用户头像组件

### 3.3 用户管理模块 (User)
- **UserProfile**: 个人资料展示和编辑页面
- **UserList**: 用户列表表格（管理员/老师视角）
- **UserForm**: 用户创建/编辑表单
- **RoleSelector**: 角色选择器组件
- **ClassManagement**: 班级管理界面
- **StudentListInClass**: 班级学生列表

### 3.4 题目管理模块 (Question)
- **QuestionList**: 题目列表展示（支持搜索、过滤、排序）
- **QuestionCard**: 题目卡片展示（列表项）
- **QuestionForm**: 题目创建/编辑表单
  - 题型选择器（单选、多选、填空、解答等）
  - 知识点标签输入
  - 难度选择器
  - LaTeX公式编辑器（支持数学公式）
  - 答案和解析输入区域
- **QuestionSearch**: 高级搜索面板
- **QuestionImport**: 题目批量导入组件（Excel/JSON）
- **QuestionExport**: 题目导出选项组件
- **DuplicateQuestionAlert**: 重复题目检测提示

### 3.5 试卷管理模块 (Exam Paper)
- **ExamPaperList**: 试卷列表展示
- **ExamPaperCard**: 试卷卡片
- **ExamPaperForm**: 试卷创建/编辑表单
  - 基础信息（名称、所属学科、年级等）
  - 时间限制和总分设置
  - 题目抽取方式配置（随机、按知识点、按难度等）
- **QuestionSelector**: 试卷组装中的题目选择器
  - 按知识点筛选题目
  - 按难度筛选题目
  - 按题型筛选题目
  - 预览题目内容
- **ExamPaperPreview**: 试卷预览组件（HTML格式）
- **ExportOptions**: 试卷导出选项（Word/PDF）

### 3.6 在线作答模块 (Answer)
- **ExamPlayer**: 试题播放器（作答界面主体）
  - 题目导航（上一题/下一题/题目列表）
  - 计时器显示
  - 题目内容渲染（支持各种题型）
  - 答案输入区域（根据题型动态变化）
  - 答案保存状态指示器
- **AnswerSheet**: 答案卡片式布局（适合平板作答）
- **AnswerReview**: 作答完成后的答案复核界面
- **AutoSaveIndicator**: 自动保存状态指示器
- **SubmitConfirm**: 提交确认弹窗

### 3.7 OCR功能模块 (OCR)
- **ImageUpload**: 图片上传组件（支持拖拽、预览）
- **OCRStatus**: OCR处理状态显示
- **OCRResultPreview**: OCR识别结果预览和校验
- **ManualCorrection**: 人工校验界面（低置信度结果）
- **UploadProgress**: 上传进度条

### 3.8 判卷结果模块 (Grading)
- **GradingResult**: 判卷结果展示页面
  - 分数和等级展示
  - 题目级别的正确/错误标识
  - 解答题的语义评分反馈（如适用）
  - 错题标记和跳转功能
- **QuestionFeedback**: 单题反馈展示组件
- **GradingStatistics**: 判卷统计图表（正确率、得分分布等）
- **BatchGradingView**: 批量判卷进度展示（老师视角）

### 3.9 错题本模块 (Error Notebook)
- **ErrorNotebookList**: 错题本列表展示
- **ErrorNotebookCard**: 错题本卡片
- **ErrorNotebookDetail**: 错题本详情页面
  - 错题目列展示
  - 错题对应的知识点标签
  - 加强练习题展示和作答功能
  - 导出/打印按钮
- **ErrorStats**: 错题统计图表（按知识点、时间分布等）
- **ErrorNotebookExport**: 错题本导出选项组件

### 3.10 自学功能模块 (Self Study)
- **StudyDashboard**: 自学首页仪表盘
  - 学习进度条
  - 推荐练习题
  - 知识点掌握度热力图
- **KnowledgePointMap**: 知识点关系图谱
- **PracticeGenerator**: 智能练习题生成器
- **ModelTrainingStatus**: 模型训练状态展示
- **DataSyncPanel**: 数据同步控制面板

## 4. 共享组件和工具

### 4.1 表单组件
- **FormItem**: 带标题和验证的表单项
- **DynamicForm**: 动态生成的表单（根据配置）
- **FormValidator**: 表单验证工具集合

### 4.2 数据展示组件
- **DataTable**: 高级数据表格（排序、过滤、分页）
- **EmptyState**: 空数据状态展示
- **SkeletonLoader**: 骨架屏加载占位符
- **Badge**: 状态标签组件
- **Tag**: 标签组件（支持颜色变体）

### 4.3 反馈组件
- **GlobalNotification**: 全局通知系统
- **ModalWrapper**: 统一的模态框包装器
- **Drawer**: 抽屉式侧边栏
- **ProgressSteps**: 多步骤进度指示器

### 4.4 导航组件
- **Breadcrumb**: 面包屑导航
- **Menu**: 侧边栏/顶部菜单
- **TabContainer**: 选项卡容器
- **Stepper**: 步骤导航组件

### 4.5 工具和Hooks
- **useAuth**: 认证状态和用户信息Hook
- **useApi**: API请求封装Hook
- **useForm**: 表单状态管理Hook
- **usePagination**: 分页逻辑Hook
- **useDebounce**: 防抖Hook
- **usePrevious**: 前值获取Hook
- **formatLaTeX**: LaTeX格式化工具
- **validateInput**: 输入验证工具集合

## 5. 主题和样式设计

### 5.1 主题定制
- 基于Ant Design的主题定制能力
- 定义主色调、辅助色、文字颜色等
- 支持深色模式（可选）
- 组件状态颜色（成功、警告、错误等）

### 5.2 响应式设计
- 移动端优先响应式布局
- 支持不同屏幕尺寸（手机、平板、桌面）
- 触摸友好的交互设计
- 自适应字体和间距

### 5.3 动画和交互
- 页面切换淡入淡出动画
- 模态框弹出收起动画
- 按钮点击反馈
- 表单验证动态提示
- 数据加载过渡效果

## 6. 国际化和可访问性

### 6.1 国际化 (i18n)
- 使用react-i18next或类似方案
- 支持中文（默认）和英文
- 易于扩展其他语言
- 动态语言切换功能

### 6.2 可访问性 (a11y)
- 符合WCAG 2.1 AA标准
- 键盘导航支持
- ARIA标签和角色
- 色彩对比度符合要求
- 焦点管理和可见性
- 图片ALT属性

## 7. 性能优化

### 7.1 代码分割
- 路由级代码分割（懒加载）
- 组件级代码分割（大型复杂组件）
- 第三方库按需加载

### 7.2 缓存策略
- API响应缓存（适用场景）
- 组件状态缓存（避免重复计算）
- 本地存储缓存（用户偏好等）

### 7.3 渲染优化
- 使用React.memo优化重复渲染
- 使用useCallback和useMemo优化回调
- 虚拟滚动列表（长列表场景）
- 图片懒加载

## 8. 错误处理和日志

### 8.1 错误边界
- 全局错误边界捕获未处理异常
- 页面级错误边界隔离故障影响
- 友好的错误提示页面

### 8.2 错误处理
- 统一的错误处理机制
- API错误统一拦截和提示
- 表单验证错误集中显示
- 网络错误重试机制

### 8.3 日志和监控
- 前端错误上报（可选）
- 性能监控埋点
- 用户行为追踪（埋点）
- 调试信息开发环境显示

## 9. 测试策略

### 9.1 单元测试
- 使用Jest和React Testing Library
- 测试组件渲染和交互
- 测试自定义Hooks
- 测试工具函数和工具类

### 9.2 集成测试
- 测试关键用户流程（登录→作答→查看结果）
- 测试表单提交和验证流程
- 测试API服务集成

### 9.3 端到端测试
- 使用Cypress或Playwright
- 测试完整用户旅程
- 测试跨页面交互
- 测试响应式布局

## 10. 构建和部署

### 10.1 构建配置
- 生产环境构建优化
- 源码映射（Source Map）配置
- 资源压缩和分离
- 环境变量管理

### 10.2 部署考虑
- 静态资源CDN部署
- 浏览器缓存策略
- gzip压缩启用
- HTTP/2支持
- 安全头部配置（CSP等）

## 11. 接口约定

### 11.1 API通信
- 使用RESTful API或GraphQL（根据后端选择）
- 统一的请求/响应格式
- 错误码和消息标准化
- 分页参数约定（pageSize, currentPage）
- 过滤和排序参数约定

### 11.2 实时通信
- WebSocket用于实时通知（如判卷完成）
- 事件订阅和发布机制
- 重连机制和心跳检测

### 11.3 文件处理
- 文件上传进度显示
- 大文件分片上传（可选）
- 文件类型和大小验证
- 安全的文件下载处理

## 12. 开发规范

### 12.1 代码风格
- 使用ESLint和Prettier统一代码风格
- TypeScript严格模式
- 组件命名采用PascalCase
- 文件和目录命名采用kebab-case
- 常量采用UPPER_SNAKE_CASE

### 12.2 Git提交规范
- 使用Conventional Commits格式
- feat: 新功能
- fix: bug修复
- docs: 文档变更
- style: 代码格式化
- refactor: 重构
- test: 测试相关
- chore: 构建或辅助工具变更

### 12.3 分支管理
- main分支：生产稳定版本
- develop分支：开发集成分支
- feature/*: 特性开发分支
- release/*: 发布准备分支
- hotfix/*: 生产紧急修复

## 13. 里程碑和时间表

### 阶段1：基础设施和认证模块（第1-2周）
- 项目初始化和配置
- 认证模块完成（登录、注册、个人资料）
- 基础布局和导航组件

### 阶段2：核心业务模块（第3-6周）
- 题目管理模块完成
- 试卷管理模块完成
- 在线作答模块完成

### 阶段3：特色功能模块（第7-9周）
- OCR功能模块完成
- 判卷结果展示完成
- 错题本功能完成

### 阶段4：高级功能和优化（第10-12周）
- 自学功能模块完成
- 性能优化和测试
- 国际化和可访问性完善
- 响应式适配完成

## 14. 风险和应对措施

### 技术风险
- 第三方库兼容性问题：提前评估并准备替代方案
- 性能瓶颈：实施性能监控和优化
- 浏览器兼容性：定期跨浏览器测试

### 业务风险
- 需求变更：采用模块化设计便于修改
- 用户体验问题：早期原型和用户测试
- 安全漏洞：定期安全审计和依赖更新

## 15. 成功标准

### 功能完整性
- 所有核心功能模块完成且可交互使用
- 响应式布局在主流设备上正常工作
- 国际化支持切换运行正常

### 性能指标
- 首屏加载时间 < 3秒（3G网络）
- 交互响应时间 < 200ms
- 白屏时间 < 1.5秒

### 质量标准
- 单元测试覆盖率 > 80%
- 没有已知的严重安全漏洞
- 可访问性符合WCAG 2.1 AA标准
- 主流浏览器（Chrome, Firefox, Safari, Edge）兼容

## 16. 实施时间表

| 阶段 | 工作内容 | 预计时间 | 里程碑 |
|------|----------|----------|--------|
| 第1周 | 项目初始化、基础设施、认证模块 | 5天 | 登录注册功能完成 |
| 第2周 | 基础布局、导航、基础组件库 | 3天 | 基础UI框架搭建完成 |
| 第3周 | 题目管理模块（列表、表单、详情） | 4天 | 题目CRUD功能完成 |
| 第4周 | 试卷管理模块（创建、组装、预览） | 4天 | 试卷管理功能完成 |
| 第5周 | 在线作答模块（播放器、答题交互） | 4天 | 作答功能基本可用 |
| 第6周 | 判卷结果展示模块 | 3天 | 判卷结果页面完成 |
| 第7周 | OCR功能模块（上传、状态、预览） | 4天 | OCR功能完成 |
| 第8周 | 错题本功能模块（列表、详情、导出） | 4天 | 错题本功能完成 |
| 第9周 | 自学功能模块（仪表盘、练习生成） | 4天 | 自学功能基本可用 |
| 第10周 | 性能优化（代码分割、缓存、懒加载） | 3天 | 性能指标达标 |
| 第11周 | 国际化和可访问性完善 | 3天 | i18n和a11y符合标准 |
| 第12周 | 响应式适配和跨浏览器测试 | 3天 | 主流设备兼容 |
| 第13周 | 集成测试和端到端测试 | 4天 | 关键用户流程测试通过 |
| 第14周 | 构建部署配置和文档编写 | 3天 | 部署脚本和使用文档完成 |
| 第15周 | 综合验证和修改 | 3天 | 最终定稿 |
| 第16周 | 与后端API对接调试 | 3天 | 前后端联调通过 |

## 17. 验收标准

1. 所有核心功能模块完成且可交互使用，涵盖用户、题目、试卷、作答、OCR、判卷、错题本、自学等模块。
2. 响应式布局在主流移动设备（iOS/Android）和桌面浏览器上正常工作。
3. 国际化支持中英文切换，界面文字正确显示。
4. 首屏加载时间（3G网络）小于3秒，交互响应时间小于200ms。
5. 单元测试覆盖率超过80%，关键路径有集成测试。
6. 无已知的严重安全漏洞（如XSS、CSRF等），输入验证完善。
7. 可访问性符合WCAG 2.1 AA标准，支持键盘导航和屏幕阅读器。
8. 主流浏览器（Chrome, Firefox, Safari, Edge）均能正常运行。
9. 前端与后端API接口对接成功，数据交互正常。
10. 构建产物体积合理，启动速度快，支持CDN部署。

## 18. 相关文件

- 后端API设计计划：docs/backend-api-plan.md
- 数据库架构和迁移计划：docs/database-design.md
- OCR服务集成计划：docs/ocr-integration-plan.md
- 判卷服务实现计划：docs/grading-implementation-plan.md
- 错题本服务设计：docs/error-notebook-design.md
- 自学调度服务规划：docs/self-study-scheduling-plan.md
- 系统架构说明：CLAUDE.md 第119-154节
- 开发指南：CLAUDE.md 第179-202节
- 数据库设计部分：CLAUDE.md 第186-190节
- 性能考虑部分：CLAUDE.md 第197-202节