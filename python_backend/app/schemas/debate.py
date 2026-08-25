from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class DebateCreateRequest(BaseModel):
    topic: str
    position: str  # user's position (AI takes opposing)
    subjectId: Optional[str] = None


class DebateArgueRequest(BaseModel):
    argument: str


class DebateSessionResponse(BaseModel):
    id: str
    topic: str
    userPosition: str
    aiPosition: str
    subjectId: Optional[str] = None
    status: str  # active, completed
    roundNumber: int
    conversationHistory: List[Dict[str, str]]
    assessment: Optional[Dict[str, Any]] = None
