# OCR 服务集成文档

> 版本: V3.0 | 日期: 2026-05-25 | 状态: Tesseract 阶段 A 已完成，PaddleOCR 阶段 B 待 V3.1

---

## 1. 概述

OCR 服务负责处理学生拍照上传的答卷图片，识别为结构化文本后提交判卷。

**分阶段实现**:
- **阶段 A (V3.0 已完成)**: Tesseract OCR 集成，本地文件系统存储，人工校验流程
- **阶段 B (V3.1 计划)**: PaddleOCR GPU 加速，MinIO 对象存储，自动置信度判定

---

## 2. 当前架构 (阶段 A)

```
前端上传图片 → 后端接收 → 保存本地文件系统
                              ↓
                    Tesseract OCR (pytesseract + Pillow)
                              ↓
                    结构化文本 + 置信度评分
                              ↓
                    置信度 < 0.7 → NEEDS_REVIEW 状态
                    置信度 >= 0.7 → COMPLETED
                              ↓
                    前端编辑修正 → 提交判卷
```

---

## 3. 服务实现

### 3.1 OCR Service (`app/services/ocr_service.py`)

```python
class OCRService:
    def process_image(self, file_path: str) -> OCRResult:
        # 1. Pillow 打开图片
        # 2. pytesseract.image_to_data() 获取文字+置信度
        # 3. 结构化: 提取答题区域、选项、填空答案
        # 4. 计算平均置信度
        # 5. 返回 OCRResult(text, confidence, structured_data)
```

依赖:
```bash
pip install pytesseract Pillow
# 系统依赖: tesseract-ocr (apt/yum)
```

### 3.2 模型 (`app/models/ocr_upload.py`)

```python
class OcrUpload(Base):
    id: UUID PK
    student_id: UUID FK
    exam_paper_id: UUID FK
    file_path: VARCHAR(500)
    status: VARCHAR(20)  # PENDING / PROCESSING / COMPLETED / FAILED / NEEDS_REVIEW
    recognized_text: TEXT
    confidence: FLOAT
    created_at: DateTime
    updated_at: DateTime
```

**V3.0 新增**: `NEEDS_REVIEW` 状态，用于低置信度人工审核。

---

## 4. API 端点

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/ocr/upload` | 上传图片，触发 OCR 处理 | 完成 |
| GET | `/ocr/status/{id}` | 查询处理状态 | 完成 |
| GET | `/ocr/result/{id}` | 获取识别结果 | 完成 |
| GET | `/ocr/config` | 获取 OCR 配置 | 完成 |

上传流程:
1. 前端 POST 图片文件
2. 后端保存到本地磁盘，创建 `OcrUpload` 记录(status=PENDING)
3. 调用 `OCRService.process_image()`
4. 更新记录为 COMPLETED / NEEDS_REVIEW / FAILED
5. 前端轮询 status，结果可编辑后提交到 `/answers`

---

## 5. 阶段 B 设计 (V3.1)

### 5.1 PaddleOCR GPU 集成

```python
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang='ch', use_gpu=True)
result = ocr.ocr(image_path, cls=True)
```

优势:
- 中文识别率显著高于 Tesseract
- GPU 加速（DGX Spark）
- 版面分析能力更强

### 5.2 MinIO 对象存储

```python
# 图片存储改为 MinIO
minio_client.put_object("ocr-uploads", object_name, file_data, length)
file_path = f"minio://ocr-uploads/{object_name}"
```

### 5.3 自动置信度阈值

```python
if avg_confidence < 0.6:
    status = NEEDS_REVIEW
elif avg_confidence < 0.85:
    status = COMPLETED  # 但标记建议复核
else:
    status = COMPLETED  # 高置信度，直接进入判卷
```

---

## 6. 已知限制

| 限制 | 说明 | 解决计划 |
|------|------|----------|
| Tesseract 中文识别率有限 | 手写体、复杂排版识别差 | V3.1 PaddleOCR |
| 本地文件系统存储 | 无高可用、无 CDN | V3.1 MinIO |
| 同步处理 | 大图片阻塞请求 | V3.1 Celery 异步 |
| 无版面分析 | 无法自动分割题目区域 | V3.1 PaddleOCR layout |

---

## 7. 与 V1.0 设计差异

| V1.0 设计 | V3.0 实际 |
|-----------|-----------|
| PaddleOCR 为主 | Tesseract 为主(PaddleOCR 待集成) |
| MinIO 预签名 URL 上传 | 直接 POST 到后端，本地存储 |
| 消息队列异步处理 | 同步处理 |
| 批处理 API | 单张处理 |
| 无 NEEDS_REVIEW 状态 | 已添加人工审核状态 |
