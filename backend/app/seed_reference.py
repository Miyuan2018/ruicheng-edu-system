"""Idempotent reference data seeder — safe to call on every startup."""
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.reference import (
    QuestionType, DifficultyLevel, GradeLevel,
    PaperStatus, ErrorType, QuestionSource, Province,
)

SEED_DATA = {
    QuestionType: [
        {"code": "SINGLE_CHOICE", "name": "单选题", "color": "blue", "sort_order": 1},
        {"code": "MULTIPLE_CHOICE", "name": "多选题", "color": "purple", "sort_order": 2},
        {"code": "FILL_BLANK", "name": "填空题", "color": "green", "sort_order": 3},
        {"code": "SUBJECTIVE", "name": "解答题", "color": "orange", "sort_order": 4},
    ],
    DifficultyLevel: [
        {"code": "EASY", "name": "简单", "color": "green", "sort_order": 1},
        {"code": "MEDIUM", "name": "中等", "color": "orange", "sort_order": 2},
        {"code": "HARD", "name": "困难", "color": "red", "sort_order": 3},
    ],
    GradeLevel: [
        {"code": "G5", "name": "五年级", "sort_order": 1},
        {"code": "G6", "name": "六年级", "sort_order": 2},
        {"code": "G7", "name": "七年级", "sort_order": 3},
        {"code": "G8", "name": "八年级", "sort_order": 4},
        {"code": "G9", "name": "九年级", "sort_order": 5},
        {"code": "G10", "name": "高一", "sort_order": 6},
        {"code": "G11", "name": "高二", "sort_order": 7},
        {"code": "G12", "name": "高三", "sort_order": 8},
    ],
    PaperStatus: [
        {"code": "DRAFT", "name": "草稿"},
        {"code": "PUBLISHED", "name": "已发布"},
        {"code": "ARCHIVED", "name": "已归档"},
    ],
    ErrorType: [
        {"code": "CONCEPT", "name": "概念错误"},
        {"code": "MEMORY", "name": "记忆错误"},
        {"code": "UNDERSTANDING", "name": "理解偏差"},
        {"code": "CALCULATION", "name": "计算错误"},
        {"code": "UNANSWERED", "name": "未作答"},
    ],
    QuestionSource: [
        {"code": "MANUAL", "name": "人工录入", "color": "blue"},
        {"code": "LLM_GENERATED", "name": "大模型生成", "color": "purple"},
        {"code": "SCRAPED", "name": "爬取采集", "color": "orange"},
        {"code": "OCR_UPLOAD", "name": "OCR识别", "color": "cyan"},
    ],
    Province: [
        {"code": "HLJ", "name": "黑龙江", "sort_order": 1},
        {"code": "JL", "name": "吉林", "sort_order": 2},
        {"code": "LN", "name": "辽宁", "sort_order": 3},
        {"code": "SH", "name": "上海", "sort_order": 4},
        {"code": "JS", "name": "江苏", "sort_order": 5},
        {"code": "ZJ", "name": "浙江", "sort_order": 6},
    ],
}


async def seed_reference_data(db: AsyncSession):
    """Insert seed data for each reference table if empty. Idempotent."""
    for model_cls, rows in SEED_DATA.items():
        existing = await db.execute(select(model_cls).limit(1))
        if existing.scalar_one_or_none():
            continue
        for row in rows:
            obj = model_cls(id=str(uuid.uuid4()), **row)
            db.add(obj)
            await db.flush()
        await db.commit()
