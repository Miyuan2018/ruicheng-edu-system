# 后端API设计计划

> **V1.0 实现状态 (2026-05-17)**: 68 个 API 端点已注册。
> ✅=已实现 ⚠️=骨架存在 ❌=未实现
>
> | 服务 | 端点 | 状态 |
> |------|------|------|
> | Auth | 6 | ✅ 全部实现 |
> | Users | 8 | ✅ CRUD + 角色管理 |
> | Questions | 11 | ✅ CRUD + 搜索/导入导出 |
> | Exam Papers | 11 | ✅ CRUD + 组装, ⚠️ Word/PDF导出空壳 |
> | Answers | 7 | ✅ CRUD, ⚠️ 判卷链路未通 |
> | OCR | 9 | ⚠️ API存在, ❌ PaddleOCR/MinIO未集成 |
> | Grading | 9 | ⚠️ API存在, ❌ 规则/LLM引擎未实现 |
> | Error Notebooks | 8 | ⚠️ API存在, ❌ 生成/导出未实现 |
> | Self Study | 15 | ❌ 全部为占位实现 |
>
> V2.0 详见 `docs/requirements-v2.0.md`

## 概述
本计划为edu_system项目的后端API设计，涵盖用户服务、题目服务、试卷服务、答案服务、OCR服务、判卷服务、错题本服务和自学调度服务的API接口设计。

## 1. 用户服务 (User Service)

### 1.1 功能描述
处理用户认证、授权、角色管理和个人信息维护

### 1.2 API接口设计

#### 认证相关
- POST /api/v1/auth/register - 用户注册
- POST /api/v1/auth/login - 用户登录
- POST /api/v1/auth/refresh - 刷新访问令牌
- POST /api/v1/auth/logout - 用户登出
- POST /api/v1/auth/reset-password - 重置密码
- POST /api/v1/auth/verify-email - 验证邮箱

#### 用户管理
- GET /api/v1/users/me - 获取当前用户信息
- PUT /api/v1/users/me - 更新当前用户信息
- GET /api/v1/users/{user_id} - 获取指定用户信息（管理员/老师）
- PUT /api/v1/users/{user_id} - 更新指定用户信息（管理员）
- DELETE /api/v1/users/{user_id} - 删除用户（管理员）
- GET /api/v1/users - 分页获取用户列表（管理员）
- POST /api/v1/users/{user_id}/role - 修改用户角色（管理员）

#### 班级管理（老师/管理员）
- POST /api/v1/classes - 创建班级
- GET /api/v1/classes - 获取班级列表
- GET /api/v1/classes/{class_id} - 获取班级详情
- PUT /api/v1/classes/{class_id} - 更新班级信息
- DELETE /api/v1/classes/{class_id} - 删除班级
- POST /api/v1/classes/{class_id}/students - 添加学生到班级
- DELETE /api/v1/classes/{class_id}/students/{student_id} - 从班级移除学生

## 2. 题目服务 (Question Service)

### 2.1 功能描述
管理题目库，包括题目增删改查、搜索、去重等功能

### 2.2 API接口设计

#### 题目管理
- POST /api/v1/questions - 创建题目
- GET /api/v1/questions/{question_id} - 获取题目详情
- PUT /api/v1/questions/{question_id} - 更新题目
- DELETE /api/v1/questions/{question_id} - 删除题目
- GET /api/v1/questions - 分页获取题目列表（支持过滤、排序、搜索）

#### 题目搜索和过滤
- GET /api/v1/questions/search - 高级搜索题目（支持知识点、难度、题型、关键词等过滤）
- GET /api/v1/questions/tags - 获取所有题目标签
- GET /api/v1/questions/knowledge-points - 获取所有知识点

#### 题目导入导出
- POST /api/v1/questions/batch-import - 批量导入题目（Excel/JSON）
- GET /api/v1/questions/export - 导出题目（支持格式选择）

#### 题目去重
- POST /api/v1/questions/deduplicate - 检测并处理重复题目

## 3. 试卷服务 (Exam Paper Service)

### 3.1 功能描述
管理试卷创建、组装、导出和版本控制

### 3.2 API接口设计

#### 试卷管理
- POST /api/v1/exam-papers - 创建试卷
- GET /api/v1/exam-papers/{exam_paper_id} - 获取试卷详情
- PUT /api/v1/exam-papers/{exam_paper_id} - 更新试卷
- DELETE /api/v1/exam-papers/{exam_paper_id} - 删除试卷
- GET /api/v1/exam-papers - 分页获取试卷列表

#### 试卷组装
- POST /api/v1/exam-papers/{exam_paper_id}/questions - 添加题目到试卷
- DELETE /api/v1/exam-papers/{exam_paper_id}/questions/{question_id} - 从试卷移除题目
- PUT /api/v1/exam-papers/{exam_paper_id}/questions/sort - 调整试卷中题目顺序
- GET /api/v1/exam-papers/{exam_paper_id}/questions - 获取试卷中的题目列表

#### 试卷导出
- GET /api/v1/exam-papers/{exam_paper_id}/export/word - 导出试卷为Word格式
- GET /api/v1/exam-papers/{exam_paper_id}/export/pdf - 导出试卷为PDF格式
- GET /api/v1/exam-papers/{exam_paper_id}/preview - 预览试卷（HTML格式）

#### 试卷模板
- POST /api/v1/exam-paper-templates - 创建试卷模板
- GET /api/v1/exam-paper-templates - 获取试卷模板列表
- GET /api/v1/exam-paper-templates/{template_id} - 获取模板详情

## 4. 答案服务 (Answer Service)

### 4.1 功能描述
处理学生答案提交（在线作答和OCR上传）、临时存储和判卷调度

### 4.2 API接口设计

#### 在线作答
- POST /api/v1/answers - 提交在线作答答案
- GET /api/v1/answers/{answer_id} - 获取答案详情
- PUT /api/v1/answers/{answer_id} - 更新答案（提交前可修改）
- GET /api/v1/answers/student/{student_id}/exam/{exam_paper_id} - 获取学生特定试卷的答案

#### OCR答案上传
- POST /api/v1/answers/ocr-upload - 上传OCR识别的答案图片
- GET /api/v1/answers/ocr-status/{upload_id} - 查询OCR处理状态
- GET /api/v1/answers/ocr-result/{upload_id} - 获取OCR识别结果

#### 答案管理
- GET /api/v1/answers/student/{student_id} - 获取学生的所有答案
- GET /api/v1/answers/exam/{exam_paper_id} - 获取特定试卷的所有答案（老师/管理员）
- DELETE /api/v1/answers/{answer_id} - 删除答案

## 5. OCR服务 (OCR Service)

### 5.1 功能描述
处理图片上传、OCR识别和结果返回

### 5.2 API接口设计

#### 图片上传
- POST /api/v1/ocr/upload - 上传待识别的图片
- GET /api/v1/ocr/status/{upload_id} - 查询OCR处理状态
- GET /api/v1/ocr/result/{upload_id} - 获取OCR识别结果

#### OCR配置
- GET /api/v1/ocr/config - 获取OCR配置信息
- PUT /api/v1/ocr/config - 更新OCR配置（管理员）

#### 批处理
- POST /api/v1/ocr/batch-upload - 批量上传图片进行OCR识别
- GET /api/v1/ocr/batch-status/{batch_id} - 查询批处理状态

## 6. 判卷服务 (Grading Service)

### 6.1 功能描述
自动判卷服务，处理选择/填空题规则匹配和解答题语义评分

### 6.2 API接口设计

#### 判卷触发
- POST /api/v1/grading/start - 触发答案判卷
- GET /api/v1/grading/status/{grading_id} - 查询判卷状态
- GET /api/v1/grading/result/{grading_id} - 获取判卷结果

#### 判卷历史
- GET /api/v1/grading/history/student/{student_id} - 获取学生判卷历史
- GET /api/v1/grading/history/exam/{exam_paper_id} - 获取试卷判卷统计

#### 模型管理
- GET /api/v1/grading/models - 获取可用判卷模型列表
- POST /api/v1/grading/models/switch - 切换判卷模型（管理员）
- GET /api/v1/grading/models/current - 获取当前使用的判卷模型

## 7. 错题本服务 (Error Notebook Service)

### 7.1 功能描述
生成学生错题本，包含错误题目和针对性加强练习

### 7.2 API接口设计

#### 错题本生成
- POST /api/v1/error-notebooks/generate - 为学生生成错题本
- GET /api/v1/error-notebooks/{notebook_id} - 获取错题本详情
- GET /api/v1/error-notebooks/student/{student_id} - 获取学生的所有错题本
- DELETE /api/v1/error-notebooks/{notebook_id} - 删除错题本

#### 错题本导出
- GET /api/v1/error-notebooks/{notebook_id}/export/pdf - 导出错题本为PDF
- GET /api/v1/error-notebooks/{notebook_id}/export/word - 导出错题本为Word

#### 错题统计
- GET /api/v1/error-notebooks/stats/student/{student_id} - 获取学生错题统计
- GET /api/v1/error-notebooks/stats/class/{class_id} - 获取班级错题统计（老师/管理员）

## 8. 自学调度服务 (Self-study Scheduling Service)

### 8.1 功能描述
处理自学任务、知识点建模、题目生成和模型微调触发

### 8.2 API接口设计

#### 自学任务管理
- POST /api/v1/self-study/tasks - 创建自学任务
- GET /api/v1/self-study/tasks/{task_id} - 获取自学任务详情
- PUT /api/v1/self-study/tasks/{task_id} - 更新自学任务
- DELETE /api/v1/self-study/tasks/{task_id} - 删除自学任务
- GET /api/v1/self-study/tasks - 分页获取自学任务列表（管理员）

#### 知识点建模
- POST /api/v1/self-study/knowledge-points/extract - 从抓取内容中提取知识点
- GET /api/v1/self-study/knowledge-points - 获取知识点列表
- GET /api/v1/self-study/knowledge-points/{kp_id} - 获取知识点详情

#### 题目生成
- POST /api/v1/self-study/questions/generate - 基于知识点自动生成练习题
- GET /api/v1/self-study/questions/generate-status/{generation_id} - 查询题目生成状态

#### 模型微调触发
- POST /api/v1/self-study/model/train - 触发模型微调训练
- GET /api/v1/self-study/model/train-status/{train_id} - 查询训练状态
- GET /api/v1/self-study/model/train-history - 获取训练历史

#### 数据同步
- POST /api/v1/self-study/data/sync - 触发题库数据同步
- GET /api/v1/self-study/data/sync-status/{sync_id} - 查询同步状态

## 9. 共享模型和枚举

### 9.1 公共响应格式
所有API响应统一使用以下格式：
```json
{
  "code": 200,
  "message": "成功",
  "data": {},
  "timestamp": "2026-05-15T10:00:00Z"
}
```

错误响应格式：
```json
{
  "code": 400,
  "message": "错误描述",
  "data": null,
  "timestamp": "2026-05-15T10:00:00Z"
}
```

### 9.2 常用枚举
- 用户角色: STUDENT, TEACHER, ADMIN
- 题目类型: SINGLE_CHOICE, MULTIPLE_CHOICE, FILL_BLANK, SUBJECTIVE
- 难度级别: EASY, MEDIUM, HARD
- 试卷状态: DRAFT, PUBLISHED, ARCHIVED
- 答案状态: SUBMITTED, GRADING, GRADED, RETURNED
- OCR状态: PENDING, PROCESSING, COMPLETED, FAILED
- 判卷状态: PENDING, PROCESSING, COMPLETED, FAILED

## 10. 安全考虑

### 10.1 认证和授权
- 所有API接口（除登录/注册外）要求JWT token认证
- 基于RBAC的权限控制：
  - STUDENT: 只能访问自己的数据
  - TEACHER: 能访问自己创建的资源和所教授班级的数据
  - ADMIN: 能访问所有资源

### 10.2 数据验证
- 所有输入参数进行严格验证
- 防止SQL注入、XSS攻击
- 文件上传大小和类型限制

### 10.3 速率限制
- 对敏感接口实施速率限制（如登录、注册）
- 防止暴力破解和滥用

## 11. 性能考虑

### 11.1 数据库优化
- 为频繁查询的字段建立索引（如用户ID、题目知识点、试卷ID等）
- 使用连接池管理数据库连接
- 大结果集使用分页查询

### 11.2 缓存策略
- 使用Redis缓存频繁访问的数据（如用户会话、热门试题等）
- 对于判卷结果等计算密集型操作适用缓存

### 11.3 异步处理
- 耗时操作通过消息队列处理（OCR识别、判卷、错题本生成等）
- 避免长时间阻塞HTTP请求

## 12. 接口版本管理
- 使用URL路径进行版本管理（/api/v1/...）
- 保持向后兼容性，重大变更增加版本号
- 废弃的接口在文档中明确标注并提供迁移路径

## 13. 测试考虑
- 每个API接口应有对应的单元测试
- 关键路径应有集成测试
- 性能测试应考虑并发场景
- 安全测试应包括常见攻击向量的防护

## 14. 实施时间表

| 阶段 | 工作内容 | 预计时间 | 里程碑 |
|------|----------|----------|--------|
| 第1周 | 需求分析和API接口规划 | 2天 | 需求确认 |
| 第1周 | 基础CRUD接口设计（用户、题目、试卷等） | 3天 | 基础接口可用 |
| 第2周 | 认证和授权接口实现 | 2天 | 登录/注册/令牌刷新功能完成 |
| 第2周 | 用户管理、班级管理接口 | 2天 | 用户、班级CRUD完成 |
| 第3周 | 题目服务接口（增删改查、搜索、导入导出） | 3天 | 题目管理功能完成 |
| 第3周 | 试卷服务接口（创建、组装、导出） | 2天 | 试卷管理功能完成 |
| 第4周 | 答案服务接口（提交、OCR上传、管理） | 2天 | 答案服务完成 |
| 第4周 | OCR服务接口（上传、状态、结果） | 2天 | OCR接口完成 |
| 第5周 | 判卷服务接口（触发、状态、结果、历史、模型管理） | 3天 | 判卷服务接口完成 |
| 第5周 | 错题本服务接口（生成、导出、统计） | 2天 | 错题本服务接口完成 |
| 第6周 | 自学调度服务接口（任务、知识点、题目生成、模型训练、数据同步） | 3天 | 自学调度服务接口完成 |
| 第6周 | 安全考虑加强（JWT、RBAC、输入验证、速率限制） | 2天 | 安全措施到位 |
| 第7周 | 性能考虑实施（数据库索引建议、缓存策略、异步处理） | 2天 | 性能优化建议完成 |
| 第8周 | 测试考虑落地（单元测试、集成测试、性能测试、安全测试） | 2天 | 测试计划完成 |
| 第9周 | 文档完善和版本管理说明 | 2天 | API文档完整 |
| 第10周 | 接口版本管理和废弃策略 | 1天 | 版本控制方案 |
| 第11周 | 综合审查和修改 | 2天 | 最终定稿 |
| 第12周 | 与前端组件对接调试 | 2天 | 前后端联调通过 |

## 15. 验收标准

1. 所有API接口按照RESTful规范设计，路径清晰，方法正确。
2. 所有接口要求JWT token认证（除登录/注册外），并实施基于RBAC的权限控制。
3. 所有输入参数进行严格验证，防止SQL注入、XSS攻击。
4. 对敏感接口（登录、注册）实施速率限制。
5. API响应采用统一格式（code, message, data, timestamp），错误响应同样统一。
6. 提供详细的接口版本管理策略，保持向后兼容性。
7. 每个API接口应有对应的单元测试，关键路径有集成测试。
8. 性能测试应考虑并发场景，确保在预期负载下响应时间达标。
9. 安全测试覆盖常见攻击向量（注入、跨站脚本等）。
10. 文档完整，包括接口描述、请求/响应示例、错误码说明。

## 16. 相关文件

- 数据库架构和迁移计划：docs/database-design.md
- 前端组件开发计划：docs/frontend-component-plan.md
- OCR服务集成计划：docs/ocr-integration-plan.md
- 判卷服务实现计划：docs/grading-implementation-plan.md
- 错题本服务设计：docs/error-notebook-design.md
- 自学调度服务规划：docs/self-study-scheduling-plan.md
- 系统架构说明：CLAUDE.md 第119-154节
- 开发指南：CLAUDE.md 第179-202节
- 数据库设计部分：CLAUDE.md 第186-190节
- 性能考虑部分：CLAUDE.md 第197-202节