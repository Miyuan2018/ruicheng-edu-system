# 自学调度服务设计文档

> 版本: V3.0 | 日期: 2026-05-25 | 状态: 模型和占位端点存在，核心逻辑全部未实现

---

## 1. 概述

自学调度服务是系统二期智能核心，驱动"测验 → 整理错题 → 订正 → 加深训练"闭环的自动化升级。

**当前状态**: `self_study_tasks` 模型和 `/self-study` 占位端点存在，前端无路由。**全部核心逻辑未实现**。

**计划**:
- V3.4: 前端自学任务页面 (`/self-study`) + 基本 CRUD
- V3.2: 完整智能调度引擎 (Airflow + 爬虫 + 模型微调)

---

## 2. 架构愿景 (V3.2)

```
Airflow DAG 调度器
      ↓
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  网络爬虫   │  │ 知识点建模  │  │ 题目生成    │
│ (Scrapy)    │  │ (BERT/NLP)  │  │ (LLM/模板)  │
└─────────────┘  └─────────────┘  └─────────────┘
      ↓                  ↓                ↓
      └──────────────────┴────────────────┘
                         ↓
                  PostgreSQL (题库)
                         ↓
                  模型微调 (LoRA)
                         ↓
                  MLflow 模型注册表
                         ↓
                  判卷引擎 (新模型)
```

---

## 3. 数据模型

### 3.1 self_study_tasks (自学任务)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| title | VARCHAR(200) | 任务标题 |
| description | TEXT | |
| task_type | VARCHAR(20) | KNOWLEDGE_EXTRACTION / QUESTION_GENERATION / MODEL_TRAINING / DATA_SYNC |
| status | VARCHAR(20) | PENDING / RUNNING / COMPLETED / FAILED / CANCELLED |
| priority | INTEGER | 1-10 |
| parameters | JSONB | 任务参数 |
| schedule | VARCHAR(100) | cron 表达式或一次性时间 |
| created_by | UUID FK | |
| created_at | DateTime(tz) | |

**状态**: 表已创建，无数据写入逻辑。

---

## 4. API 端点 (占位状态)

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET/POST | `/self-study/tasks` | 列表/创建 | 占位 |
| GET | `/self-study/tasks/{id}` | 详情 | 占位 |
| PUT | `/self-study/tasks/{id}` | 更新 | 占位 |
| DELETE | `/self-study/tasks/{id}` | 删除 | 占位 |
| POST | `/self-study/{id}/complete` | 标记完成 | 占位 |

---

## 5. V3.4 短期实现 (前端 + 基础后端)

### 5.1 前端 SelfStudyPage (`/self-study`)

学生视图:
- 任务列表: 标题、类型、状态、优先级、截止时间
- 任务详情: 描述、参数、结果数据
- 完成按钮 → `POST /self-study/{id}/complete`

教师视图:
- 创建任务并分配给学生/班级
- 查看任务完成进度

### 5.2 后端补充

- `self_study.py` 端点从占位改为实际 CRUD
- 任务与学生的关联表(如需要)
- 任务完成状态更新

---

## 6. V3.2 长期实现 (智能调度引擎)

### 6.1 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 工作流编排 | Apache Airflow | DAG 定义调度任务 |
| 爬虫 | Scrapy / Playwright | 抓取上海教委、名校试卷等 |
| 知识点建模 | spaCy / BERT | NER + 主题聚类 |
| 题目生成 | Ollama API | 基于模板或大模型生成 |
| 模型微调 | PEFT (LoRA/QLoRA) | 参数高效微调 |
| 任务队列 | Celery + Redis | 替代同步处理 |
| 模型仓库 | MLflow | 版本控制 + 性能追踪 |
| 对象存储 | MinIO | 模型文件 + 训练数据 |

### 6.2 Airflow DAG 示例

```python
# weekly_scrape_dag.py
with DAG('weekly_math_scrape', schedule='0 2 * * 0'):
    scrape_task = PythonOperator(task_id='scrape', python_callable=scrape_shanghai_math)
    extract_kp = PythonOperator(task_id='extract_knowledge', python_callable=extract_knowledge_points)
    generate_questions = PythonOperator(task_id='generate', python_callable=generate_questions_from_kp)
    review_queue = PythonOperator(task_id='queue_for_review', python_callable=queue_for_human_review)

    scrape_task >> extract_kp >> generate_questions >> review_queue
```

### 6.3 模型微调流水线

```python
# fine_tune_dag.py
with DAG('nightly_model_finetune', schedule='0 2 * * *'):
    prepare_data = prepare_training_data()  # 从错题本+标准答案对
    train = run_lora_training()             # QLoRA on qwen3-coder
    evaluate = evaluate_model()             # 判卷 F1 分数
    register = register_to_mlflow()         # 版本注册
    ab_test = enable_ab_test()              # 5% 流量
```

### 6.4 监控指标

| 指标 | 目标 | 告警阈值 |
|------|------|----------|
| 判卷 F1 分数 | > 0.85 | < 0.80 触发回滚 |
| 题目多样性 (self-BLEU) | > 0.6 | < 0.5 告警 |
| 推理延迟 (P95) | < 3s | > 5s 告警 |
| GPU 利用率 | 40-80% | > 95% 持续 10min |

---

## 7. 与 V1.0 设计差异

| V1.0 设计 | V3.0 实际 |
|-----------|-----------|
| RabbitMQ/Kafka 队列 | 未部署，计划用 Celery+Redis |
| Airflow 已集成 | 未部署 |
| MinIO 已集成 | 未部署 |
| MLflow 已集成 | 未部署 |
| 爬虫已运行 | 未实现 |
| 模型微调已触发 | 未实现 |
| 全部端点实现 | 仅占位 |
