# edu_system 项目总览与迭代规划

## V1.0 交付摘要 (2026-05-17)

### 运行中服务
| 服务 | 地址 | 技术 |
|------|------|------|
| 后端 API | http://localhost:8000 | FastAPI + SQLAlchemy + SQLite |
| 前端 SPA | http://localhost:3000 | React 18 + Ant Design + TypeScript |
| API 文档 | http://localhost:8000/docs | OpenAPI (Swagger) |
| 一键启动 | `./start.sh` | Bash 自动化 |

### V1.0 指标
| 指标 | 值 |
|------|-----|
| API 端点 | 68 个 (8个服务模块) |
| 数据库表 | 17 张 |
| 后端源文件 | 42 个 Python 文件, 3,406 行 |
| 前端源文件 | 20 个 TSX/TS 文件, 2,094 行 |
| TypeScript | 零错误 |

### V1.0 功能完成度
| 模块 | 完成度 | 说明 |
|------|--------|------|
| 用户认证 | 100% | 注册/登录/JWT/RBAC |
| 试题管理 | 90% | CRUD/搜索/批量导入导出 |
| 试卷管理 | 60% | CRUD 完整, Word/PDF 导出空壳 |
| 在线作答 | 50% | 前端完整, 判卷链路未通 |
| 自动判卷 | 30% | API 存在, 规则/LLM 引擎未实现 |
| OCR 识别 | 20% | API 存在, PaddleOCR/MinIO 未集成 |
| 错题本 | 30% | API 存在, 生成/导出未实现 |
| 教师后台 | 70% | 班级管理完整, 统计部分实现 |
| 管理后台 | 80% | 用户管理/系统配置完整 |
| 通知服务 | 5% | 仅数据模型 |
| 自学调度 | 5% | 仅占位 |

---

## V2.0 迭代规划

### 四条核心链路
```
S1 判卷链路:  答题 → 规则匹配 → 得分反馈 → 错题收集
S2 错题本链路: 错题 → 知识点匹配 → 强化练习 → Word/PDF导出
S3 OCR链路:   拍照 → MinIO → PaddleOCR → 结构化 → 人工校验
S4 通知链路:  事件 → WebSocket + SMTP 实时推送
```

### 里程碑
| 阶段 | 周次 | 内容 | 验收标准 |
|------|------|------|----------|
| S1 判卷链路 | 1-2 | 规则匹配引擎 + 判卷自动触发 | 客观题 2s 内出分 |
| S2 错题本链路 | 3-4 | 错题收集 + 知识点匹配 + 导出 | 错题本可生成并下载 |
| S3 OCR链路 | 5-6 | MinIO + PaddleOCR + 结构化 | 拍照上传到出分完整流程 |
| S4 通知服务 | 7 | WebSocket + SMTP + 前端通知 | 判卷完成后收到通知 |
| S5 基础设施 | 8-9 | PostgreSQL + Redis + 测试 + 安全 | 测试覆盖率 ≥80% |
| S6 前端增强 | 10-11 | KaTeX + 图表 + 移动端适配 | 公式编辑可用 |
| S7 部署运维 | 12-13 | Docker/K8s/CI/CD/监控 | DGX Spark 一键部署 |
| 集成测试 | 14 | 全链路 + 性能测试 | 30路并发判卷 ≤5s |

### 架构策略
V2.0 采用 **模块化单体 + 独立 Worker 进程**, 仅将 GPU 密集型任务(判卷/OCR)提取为独立 worker, 避免过早微服务化的运维负担。

### 技术债务偿还
- SQLite → PostgreSQL (开发环境保留 SQLite)
- 规则匹配判卷引擎 (客观题)
- LLM 语义评分 (主观题, Ollama/vLLM)
- PaddleOCR GPU 集成 + MinIO 对象存储
- Redis 缓存层
- 审计日志 + 速率限制中间件
- pytest 单元测试 + Playwright E2E (≥80% 覆盖)
- Docker Compose 完整环境 (含 PostgreSQL/Redis/MinIO)
- K8s + Helm + GitHub Actions CI/CD

---

## 相关文档
- **需求分析 V2.0**: `docs/requirements-v2.0.md`
- 后端 API 设计: `docs/backend-api-plan.md`
- 数据库设计: `docs/database-design.md`
- 前端组件计划: `docs/frontend-component-plan.md`
- OCR 集成计划: `docs/ocr-integration-plan.md`
- 判卷服务计划: `docs/grading-implementation-plan.md`
- 错题本设计: `docs/error-notebook-design.md`
- 自学调度规划: `docs/self-study-scheduling-plan.md`
- 系统需求规格: `EDU_SYSTEM_REQUIREMENTS_V1.0`
