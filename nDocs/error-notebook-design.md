# 错题本服务设计文档

> 版本: V3.0 | 日期: 2026-05-25 | 状态: 核心功能已完成，前端对比视图待完善

---

## 1. 概述

错题本服务驱动"测验 → 整理错题 → 订正 → 加深训练"闭环中的错题整理和加强训练环节。

**当前状态**: 后端错题本生成、查看、删除已完成；前端错题本页面已完成；**纸质错题练习本导出待实现**。

---

## 2. 数据流

```
答案提交 → 自动判卷 → 检测错题
                              ↓
                    错题本生成服务 (mistake_service.py)
                              ↓
                    收集错题 + 知识点匹配 → 抽取强化练习题
                              ↓
                    写入 error_notebooks / error_notebook_questions
                              ↓
                    通知学生 (NotificationBell)
                              ↓
                    前端 MistakeBookPage 展示
```

---

## 3. 核心功能实现状态

| 功能 | 后端 | 前端 | 状态 |
|------|------|------|------|
| 错题自动收集 | 完成 | 完成 | 判卷后自动写入 |
| 错题本生成 | 完成 | 完成 | 按试卷或时间范围生成 |
| 强化练习题抽取 | 完成 | 完成 | 基于知识点匹配 |
| 错题列表展示 | 完成 | 完成 | 含筛选、预览、删除 |
| 生成加强练习题目 | 完成 | 完成 | 每道错题配 3-5 道练习题(数量可配置) |
| 错题本删除 | 完成 | 完成 | |
| **纸质错题练习本导出** | 未实现 | 未实现 | Word/PDF 打印 |
| **错题统计与分析** | 部分 | 部分 | 学习进度追踪待 R3.4-05 |

---

## 4. 数据模型

### 4.1 error_notebooks (错题本)

```python
class ErrorNotebook(Base):
    id: UUID PK
    student_id: UUID FK → students.id
    title: VARCHAR(200)
    description: TEXT
    exam_paper_id: UUID FK (可选)
    question_count: INTEGER
    status: VARCHAR(20)  # DRAFT / GENERATED / EXPORTED
    generated_at: DateTime
    completed_at: DateTime (可选)
```

### 4.2 error_notebook_questions (错题本题目)

```python
class ErrorNotebookQuestion(Base):
    id: UUID PK
    notebook_id: UUID FK → error_notebooks.id
    question_id: UUID FK → questions.id  (原错题)
    practice_question_id: UUID FK → questions.id (强化练习题)
    error_type: VARCHAR(50)
    notes: TEXT  # 学生笔记
```

---

## 5. API 端点

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/error-notebooks/generate` | 生成错题本 | 完成 |
| GET | `/error-notebooks` | 错题本列表 | 完成 |
| GET | `/error-notebooks/{id}` | 错题本详情 | 完成 |
| DELETE | `/error-notebooks/{id}` | 删除错题本 | 完成 |
| GET | `/error-notebooks/{id}/questions` | 错题本内题目 | 完成 |

**触发时机**: `/answers` 提交并判卷后，若存在错题，自动调用错题本生成。

---

## 6. 错题本生成逻辑 (`mistake_service.py`)

```python
def generate_notebook(student_id, exam_paper_id=None, time_range=None):
    # 1. 查询错题(answer_details where is_correct=false)
    # 2. 按知识点分组
    # 3. 每道错题从题库抽取同知识点强化练习题(数量读取 sysconfig.json 配置)
    # 4. 创建 ErrorNotebook + ErrorNotebookQuestion 记录(事务内)
    # 5. 发送通知: NotificationService.create_error_notebook_ready_notification()
```

配置项(存储于 `sysconfig.json`):
```json
{
  "error_notebook": {
    "practice_questions_per_error": 3
  }
}
```

---

## 7. 前端页面

### 7.1 MistakeBookPage (`/mistake-book`)

- 错题本列表(按进入系统时间排序)
- 筛选: 来源(试卷/作业)、学科、时间范围
- 操作: 预览、生成纸质练习本、删除
- 列表项: 错题出处、题目内容、错误类型、入册时间

### 7.2 PapersMistakeBookPage

- 基于试卷维度查看错题
- 分页: 在线作答 / 拍照扫描 / 生成试卷错题本

---

## 8. 待实现项

| 项 | 优先级 | 说明 |
|----|--------|------|
| 纸质错题练习本导出 | 中 | Word/PDF，含原错题+强化训练题，支持打印 |
| 错题统计 API | 低 | 错误类型分布、知识点薄弱点分析(归到 R3.4-05) |
| 学生错题笔记编辑 | 低 | 允许学生在错题上写笔记 |

---

## 9. 与 V1.0 设计差异

| V1.0 设计 | V3.0 实际 |
|-----------|-----------|
| 生成后加入消息队列 | 当前同步生成(待 Celery 化) |
| 导出到对象存储 | 当前直接返回(待 MinIO 集成) |
| LLM 生成强化练习题 | 当前从题库抽取同知识点题目 |
| 无通知集成 | 生成完成后自动发应用内通知 |
