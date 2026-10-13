from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any


class DebateCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    topic: str = Field(min_length=1, max_length=16000)
    position: str = Field(min_length=1, max_length=16000)  # user's position (AI takes opposing)
    subjectId: Optional[str] = None


class DebateArgueRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    argument: str = Field(min_length=1, max_length=16000)


class DebateSessionResponse(BaseModel):
    id: str
    topic: str = Field(min_length=1, max_length=16000)
    userPosition: str
    aiPosition: str
    subjectId: Optional[str] = None
    status: str  # active, completed
    roundNumber: int
    conversationHistory: List[Dict[str, str]]
    assessment: Optional[Dict[str, Any]] = None
