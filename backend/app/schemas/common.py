"""Common schemas and pagination dependency for FastAPI endpoints."""
import json
from fastapi import Query
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Union, Literal


class PaginationParams:
    """Reusable pagination dependency. Usage: pag = Depends(PaginationParams)"""
    def __init__(
        self,
        skip: int = Query(0, ge=0, description="跳过记录数"),
        limit: int = Query(20, ge=1, le=200, description="每页数量（最大200）"),
    ):
        self.skip = skip
        self.limit = limit


# ---------------------------------------------------------------------------
# GradeLevel — 试卷/题目适用范围 JSON Schema
# ---------------------------------------------------------------------------

class GradeLevel(BaseModel):
    """试卷或题目的适用范围结构。"""
    scope: Literal["comprehensive", "grade_comprehensive", "chapter", "knowledge_point"]
    grades: List[str] = Field(..., min_length=1, description="年级编码数组，如 ['G7','G8']")
    chapter: Optional[str] = Field(None, max_length=100, description="章节名称")
    knowledge_points: Optional[List[str]] = Field(None, description="知识点列表")

    @field_validator("chapter")
    @classmethod
    def check_chapter(cls, v: Optional[str], info) -> Optional[str]:
        scope = info.data.get("scope")
        if scope in ("chapter", "knowledge_point") and not v:
            raise ValueError("chapter 在 scope 为 chapter 或 knowledge_point 时必填")
        return v

    @field_validator("knowledge_points")
    @classmethod
    def check_knowledge_points(cls, v: Optional[List[str]], info) -> Optional[List[str]]:
        scope = info.data.get("scope")
        if scope == "knowledge_point" and not v:
            raise ValueError("knowledge_points 在 scope 为 knowledge_point 时必填")
        return v


# ---------------------------------------------------------------------------
# CorrectAnswer — 题目答案 JSON Schema
# ---------------------------------------------------------------------------

class OptionItem(BaseModel):
    label: str = Field(..., max_length=10)
    text: str = Field(..., max_length=500)


class SingleChoiceAnswer(BaseModel):
    options: List[OptionItem] = Field(..., min_length=2)
    correct_answer: str = Field(..., max_length=10)


class MultipleChoiceAnswer(BaseModel):
    options: List[OptionItem] = Field(..., min_length=2)
    correct_answer: List[str] = Field(..., min_length=1)


class FillBlankAnswer(BaseModel):
    options: None = None
    correct_answer: List[str] = Field(..., min_length=1)


class SubjectiveAnswerCorrect(BaseModel):
    keywords: List[str] = Field(..., min_length=1)
    max_score: float = Field(..., gt=0)


class SubjectiveAnswer(BaseModel):
    options: None = None
    correct_answer: SubjectiveAnswerCorrect


CorrectAnswerUnion = Union[
    SingleChoiceAnswer,
    MultipleChoiceAnswer,
    FillBlankAnswer,
    SubjectiveAnswer,
]
