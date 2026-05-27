from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ExplanationStepResponse(BaseModel):
    id: str
    step_order: int
    text: str
    panda_emotion: str = "explaining"
    board_line: Optional[str] = None

    class Config:
        from_attributes = True


class ExplanationStepCreate(BaseModel):
    step_order: int
    text: str
    panda_emotion: str = Field(default="explaining", pattern="^(idle|thinking|explaining|satisfied)$")
    board_line: Optional[str] = None


class GraphConfigModel(BaseModel):
    fn: str
    fn2: str = ""
    fn3: str = ""
    points: str = ""
    x_min: float = -6
    x_max: float = 6
    y_min: float = -8
    y_max: float = 8


class ExplanationSessionSummary(BaseModel):
    id: str
    question_id: Optional[str] = None
    title: str
    topic: Optional[str] = None
    difficulty_label: Optional[str] = None

    class Config:
        from_attributes = True


class ExplanationSessionResponse(BaseModel):
    id: str
    question_id: Optional[str] = None
    title: str
    topic: Optional[str] = None
    difficulty_label: Optional[str] = None
    problem_statement: Optional[str] = None
    graph_config: Optional[GraphConfigModel] = None
    steps: List[ExplanationStepResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExplanationSessionCreate(BaseModel):
    question_id: Optional[str] = None
    title: str = Field(..., max_length=500)
    topic: Optional[str] = Field(None, max_length=100)
    difficulty_label: Optional[str] = Field(None, max_length=50)
    problem_statement: Optional[str] = None
    graph_config: Optional[GraphConfigModel] = None
    steps: List[ExplanationStepCreate] = []
