from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from app.schemas.assessment import AssessmentBase, AssessmentText, Score


class DebateScores(BaseModel):
    argumentQuality: Score
    logicalReasoning: Score
    evidenceUse: Score
    counterargumentHandling: Score
    topicUnderstanding: Score
    questioningSkill: Score


class DebateAssessment(AssessmentBase):
    strongPoints: List[AssessmentText]
    weakPoints: List[AssessmentText]
    goodArguments: List[AssessmentText]
    unsupportedClaims: List[AssessmentText]
    logicalFallacies: List[AssessmentText]
    unrefutedCounterarguments: List[AssessmentText]
    lessonsLearned: List[AssessmentText]
    topicsToStudy: List[AssessmentText]
    scores: DebateScores


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
