from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class AIChatRequest(BaseModel):
    message: str
    subjectId: Optional[str] = None
    topicId: Optional[str] = None
    attemptId: Optional[str] = None
    conversationHistory: Optional[List[Dict[str, Any]]] = None

class AIAnalyzeRequest(BaseModel):
    attemptId: str

class AIExplainRequest(BaseModel):
    questionId: str
    attemptId: str
