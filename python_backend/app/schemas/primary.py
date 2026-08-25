"""Pydantic schemas for the authentication, assessment, and AI APIs.

The public field names deliberately mirror the existing Fastify/Zod contract.
"""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ContractModel(BaseModel):
    """Match Zod's default object behaviour: ignore unknown client fields."""

    model_config = ConfigDict(extra="ignore")


RoleValue = Literal["STUDENT", "TEACHER", "ADMIN"]
DifficultyValue = Literal["easy", "medium", "hard", "expert"]
QuestionTypeValue = Literal[
    "single_choice", "multiple_choice", "true_false", "short_answer"
]


class RegisterRequest(ContractModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    firstName: str = Field(min_length=1, max_length=50)
    lastName: str = Field(min_length=1, max_length=50)
    role: RoleValue | None = None
    groupCode: str | None = None


class LoginRequest(ContractModel):
    email: EmailStr
    password: str = Field(min_length=1)


class RefreshRequest(ContractModel):
    refreshToken: str | None = None


class UpdateProfileRequest(ContractModel):
    firstName: str | None = Field(default=None, min_length=1, max_length=50)
    lastName: str | None = Field(default=None, min_length=1, max_length=50)
    avatarUrl: str | None = None


class ChangePasswordRequest(ContractModel):
    currentPassword: str = Field(min_length=1)
    newPassword: str = Field(min_length=8, max_length=128)


class GenerateTestRequest(ContractModel):
    subjectId: UUID
    topic: str | None = None
    difficulty: DifficultyValue
    questionCount: int = Field(ge=5, le=30)
    questionTypes: list[QuestionTypeValue] = Field(min_length=1)
    mixedMode: bool | None = None


class SubmittedAnswer(ContractModel):
    questionId: UUID
    userAnswer: str | list[str] | None
    timeSpent: int | None = None


class SubmitTestRequest(ContractModel):
    answers: list[SubmittedAnswer]
    totalTime: int


class AIConversationMessage(ContractModel):
    role: Literal["user", "assistant"]
    content: str


class AIChatRequest(ContractModel):
    message: str = Field(min_length=1, max_length=2000)
    subjectId: UUID | None = None
    topicId: UUID | None = None
    attemptId: UUID | None = None
    conversationHistory: list[AIConversationMessage] | None = Field(default=None, max_length=20)


class AIAnalyzeRequest(ContractModel):
    attemptId: UUID


class AIExplainRequest(ContractModel):
    questionId: UUID
    attemptId: UUID


class GeneratedQuestion(ContractModel):
    id: str = Field(min_length=1)
    type: QuestionTypeValue
    question: str = Field(min_length=1)
    options: list[str] | None = None
    correctAnswer: str | list[str]
    explanation: str = Field(min_length=1)
    topic: str | None = None
    difficulty: DifficultyValue


class GeneratedTest(ContractModel):
    title: str = Field(min_length=1)
    subject: str = Field(min_length=1)
    topic: str | None = None
    difficulty: DifficultyValue
    questions: list[GeneratedQuestion] = Field(min_length=1)


JSONValue = dict[str, Any] | list[Any] | str | int | float | bool | None
