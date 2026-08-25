from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class FeynmanCreateRequest(BaseModel):
    topic: str
    subjectId: Optional[str] = None


class FeynmanExplainRequest(BaseModel):
    explanation: str


class FeynmanSessionResponse(BaseModel):
    id: str
    topic: str
    subjectId: Optional[str] = None
    status: str  # active, completed
    difficulty: int  # 1-5, increases over time
    messageCount: int
    conversationHistory: List[Dict[str, str]]
    assessment: Optional[Dict[str, Any]] = None
