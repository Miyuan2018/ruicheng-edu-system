"""Exam paper schemas — V3.5.1 with unit-based structure."""
import uuid
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List
from datetime import datetime

from app.schemas.common import GradeLevel


def _coerce_uuid(v: object) -> str:
    return str(v)


# ─── QuestionConfig ──────────────────────────────────────────

class QuestionConfigItem(BaseModel):
    """题型配置 (question_config JSONB 中的每一项)"""
    question_type: str
    count: int = Field(ge=1, default=1)
    score_per_question: int = Field(ge=1, default=4)
    knowledge_points: list[str] = []
    difficulty_ratio: dict[str, float] = {}  # {"EASY": 0.3, "MEDIUM": 0.5, "HARD": 0.2}


# ─── Unit Questions ──────────────────────────────────────────

class UnitQuestionCreate(BaseModel):
    """单元题目创建"""
    question_id: uuid.UUID
    question_type: str
    position: int = 0
    score: int = Field(ge=0, default=0)


class UnitQuestionResponse(BaseModel):
    """单元题目响应"""
    id: str
    unit_id: str
    question_id: str
    question_type: str
    position: int
    score: int
    question: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)

    _coerce_id = field_validator("id", mode="before")(_coerce_uuid)
    _coerce_unit_id = field_validator("unit_id", mode="before")(_coerce_uuid)
    _coerce_question_id = field_validator("question_id", mode="before")(_coerce_uuid)


# ─── Units ───────────────────────────────────────────────────

class ExamPaperUnitCreate(BaseModel):
    """单元创建"""
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    position: int = 0
    time_limit_minutes: Optional[int] = None
    question_config: list[QuestionConfigItem] = []
    questions: list[UnitQuestionCreate] = []


class ExamPaperUnitUpdate(BaseModel):
    """单元更新"""
    name: Optional[str] = None
    description: Optional[str] = None
    time_limit_minutes: Optional[int] = None
    question_config: Optional[list[QuestionConfigItem]] = None
    total_score: Optional[int] = None


class ExamPaperUnitResponse(BaseModel):
    """单元响应"""
    id: str
    exam_paper_id: str
    name: str
    description: Optional[str] = None
    position: int
    time_limit_minutes: Optional[int] = None
    question_config: list = []
    total_score: int = 0
    questions: list[UnitQuestionResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    _coerce_id = field_validator("id", mode="before")(_coerce_uuid)
    _coerce_paper_id = field_validator("exam_paper_id", mode="before")(_coerce_uuid)


# ─── Full Save ───────────────────────────────────────────────

class ExamPaperFullSave(BaseModel):
    """完整试卷保存 — 原子覆盖所有单元和题目"""
    title: str = Field(..., max_length=200)
    subject: Optional[str] = None
    grade_level: Optional[GradeLevel] = None
    total_score: int = Field(ge=0, default=0)
    duration_minutes: Optional[int] = None
    status: str = "READY"
    subtitle: Optional[str] = None
    instructions: Optional[str] = None
    description: Optional[str] = None
    show_units: bool = True
    per_unit_timer: bool = False
    difficulty_ratio: Optional[dict] = None
    units: list[ExamPaperUnitCreate] = []


# ─── Auto-Generate ──────────────────────────────────────────

class AutoGenerateRequest(BaseModel):
    difficulty_ratio: dict[str, float] = Field(default={"EASY": 0.3, "MEDIUM": 0.5, "HARD": 0.2})
    knowledge_node_ids: list[str] = Field(default=[])
    existing_question_ids: list[str] = Field(default=[])


class AlternativeQuestion(BaseModel):
    question_id: str
    title: str = ""
    difficulty: str = ""
    tags: list[str] = Field(default=[])

    model_config = ConfigDict(from_attributes=True)


class GenerateRecommendation(BaseModel):
    question_id: str
    question_type: str
    difficulty: str
    score: int
    title: str = ""
    recommendation_tags: list[str] = Field(default=[])
    alternatives: list[AlternativeQuestion] = Field(default=[])

    model_config = ConfigDict(from_attributes=True)


class GenerateReport(BaseModel):
    questions: list[GenerateRecommendation] = Field(default=[])
    constraint_dashboard: dict = Field(default={})

    model_config = ConfigDict(from_attributes=True)


class AutoGenerateResponse(BaseModel):
    questions: list[GenerateRecommendation] = Field(default=[])
    constraint_dashboard: dict = Field(default={})

    model_config = ConfigDict(from_attributes=True)


# ─── Paper CRUD ──────────────────────────────────────────────

class ExamPaperBase(BaseModel):
    title: str = Field(..., max_length=200)
    subtitle: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    status: str = Field(default="READY", pattern="^(READY|PUBLISHED|ARCHIVED)$")
    subject: Optional[str] = Field(None, max_length=50)
    grade_level: Optional[GradeLevel] = None
    total_score: int = Field(default=0, ge=0)
    duration_minutes: Optional[int] = Field(None, ge=0)
    instructions: Optional[str] = None


class ExamPaperCreate(ExamPaperBase):
    """创建试卷（仅元信息，不含单元）"""
    pass


class ExamPaperUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    subtitle: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(READY|PUBLISHED|ARCHIVED)$")
    subject: Optional[str] = Field(None, max_length=50)
    grade_level: Optional[GradeLevel] = None
    total_score: Optional[int] = Field(None, ge=0)
    duration_minutes: Optional[int] = Field(None, ge=0)
    instructions: Optional[str] = None


class ExamPaperResponse(ExamPaperBase):
    id: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    unit_count: int = 0
    question_count: int = 0

    model_config = ConfigDict(from_attributes=True)

    _coerce_id = field_validator("id", mode="before")(_coerce_uuid)
    _coerce_created_by = field_validator("created_by", mode="before")(_coerce_uuid)
