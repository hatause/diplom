from pydantic import BaseModel, Field
from typing import List, Optional, Union
from enum import Enum
import uuid

class Difficulty(str, Enum):
    easy = 'easy'
    medium = 'medium'
    hard = 'hard'
    expert = 'expert'

class QuestionType(str, Enum):
    single_choice = 'single_choice'
    multiple_choice = 'multiple_choice'
    true_false = 'true_false'
    short_answer = 'short_answer'

class GenerateTestRequest(BaseModel):
    subjectId: uuid.UUID
    topic: Optional[str] = None
    difficulty: Difficulty
    questionCount: int = Field(ge=5, le=30)
    questionTypes: List[QuestionType] = Field(min_length=1)
    mixedMode: Optional[bool] = None

class AnswerItem(BaseModel):
    questionId: uuid.UUID
    userAnswer: Optional[Union[str, List[str]]] = None
    timeSpent: Optional[int] = None

class SubmitTestRequest(BaseModel):
    answers: List[AnswerItem]
    totalTime: int

class GeneratedQuestion(BaseModel):
    id: str
    type: QuestionType
    question: str
    options: Optional[List[str]] = None
    correctAnswer: Union[str, List[str]]
    explanation: str
    topic: Optional[str] = None
    difficulty: Difficulty

class GeneratedTest(BaseModel):
    title: str
    subject: str
    topic: Optional[str] = None
    difficulty: Difficulty
    questions: List[GeneratedQuestion] = Field(min_length=1)
