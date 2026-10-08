from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from app.schemas.companion import ChatRequest

class AIChatRequest(ChatRequest):
    subjectId: Optional[str] = None
    topicId: Optional[str] = None
    attemptId: Optional[str] = None
    conversationHistory: Optional[List[Dict[str, Any]]] = Field(default=None, max_length=20)

    @field_validator('conversationHistory')
    @classmethod
    def validate_history(cls, value):
        for message in value or []:
            if message.get('role') not in ('user', 'assistant'):
                raise ValueError('History accepts user/assistant roles only')
            content = message.get('content')
            if not isinstance(content, str) or not 0 < len(content) <= 16000:
                raise ValueError('Invalid history content')
        return value

class AIAnalyzeRequest(BaseModel):
    attemptId: str

class AIExplainRequest(BaseModel):
    questionId: str
    attemptId: str
