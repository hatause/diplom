from pydantic import BaseModel, Field, model_validator, field_validator, ConfigDict
from typing import Annotated, List, Optional, Union
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
    topic: Optional[str] = Field(default=None, max_length=200)
    difficulty: Difficulty
    questionCount: int = Field(ge=5, le=30)
    questionTypes: List[QuestionType] = Field(min_length=1)
    mixedMode: Optional[bool] = None

    @field_validator("topic", mode="before")
    @classmethod
    def clean_topic(cls, value):
        return (value.strip() or None) if isinstance(value, str) else value

class SavedProgress(BaseModel):
    answers: dict[str, Optional[Union[str, List[str]]]] = Field(default_factory=dict)
    timeSpent: dict[str, Annotated[int, Field(ge=0, strict=True)]] = Field(default_factory=dict)
    currentIdx: int = Field(default=0, ge=0, strict=True)
    elapsed: int = Field(default=0, ge=0, strict=True)


class AnswerItem(BaseModel):
    questionId: uuid.UUID
    userAnswer: Optional[Union[str, List[str]]] = None
    timeSpent: Optional[int] = Field(default=None, ge=0)

class SubmitTestRequest(BaseModel):
    answers: List[AnswerItem]
    totalTime: int = Field(ge=0)

    @model_validator(mode="after")
    def unique_questions(self):
        ids = [answer.questionId for answer in self.answers]
        if len(ids) != len(set(ids)):
            raise ValueError("Каждый вопрос должен содержать только один ответ")
        return self

class GeneratedQuestion(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    id: str
    type: QuestionType
    question: str = Field(min_length=1)
    options: Optional[List[str]] = None
    correctAnswer: Union[str, List[str]]
    explanation: str
    topic: Optional[str] = None
    difficulty: Difficulty

    @model_validator(mode="after")
    def usable_answer(self):
        if self.type in (QuestionType.single_choice, QuestionType.multiple_choice):
            options = self.options or []
            answers = self.correctAnswer if isinstance(self.correctAnswer, list) else [self.correctAnswer]
            if len(options) < 2 or any(not option for option in options) or len(set(options)) != len(options):
                raise ValueError("Choice questions require unique nonempty options")
            if not answers or len(set(answers)) != len(answers) or any(answer not in options for answer in answers):
                raise ValueError("Correct answers must match options exactly")
            if self.type == QuestionType.single_choice and len(answers) != 1:
                raise ValueError("Single choice requires one correct answer")
            self.correctAnswer = answers if self.type == QuestionType.multiple_choice else answers[0]
        elif self.type == QuestionType.true_false:
            if not isinstance(self.correctAnswer, str) or self.correctAnswer.lower() not in ("true", "false"):
                raise ValueError("True/false answer must be true or false")
            self.correctAnswer = self.correctAnswer.lower()
            self.options = ["true", "false"]
        elif not isinstance(self.correctAnswer, str) or not self.correctAnswer:
            raise ValueError("Short answer requires a nonempty string")
        return self

class GeneratedTest(BaseModel):
    title: str
    subject: str
    topic: Optional[str] = None
    difficulty: Difficulty
    questions: List[GeneratedQuestion] = Field(min_length=1)
