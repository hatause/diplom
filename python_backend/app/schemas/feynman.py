from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any


class FeynmanCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    topic: str = Field(min_length=1, max_length=16000)
    subjectId: Optional[str] = None


class FeynmanExplainRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    explanation: str = Field(min_length=1, max_length=16000)


class FeynmanSessionResponse(BaseModel):
    id: str
    topic: str = Field(min_length=1, max_length=16000)
    subjectId: Optional[str] = None
    status: str  # active, completed
    difficulty: int  # 1-5, increases over time
    messageCount: int
    conversationHistory: List[Dict[str, str]]
    assessment: Optional[Dict[str, Any]] = None
