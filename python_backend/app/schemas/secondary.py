"""Pydantic payloads used by the non-test FastAPI routers.

The legacy Fastify handlers did not attach Zod schemas to these endpoints.
These permissive schemas therefore deliberately model only the fields that
the handlers read and leave validation of foreign keys/unique constraints to
PostgreSQL, just as Prisma did.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class _Payload(BaseModel):
    """Accept legacy clients that may send fields added by newer frontends."""

    model_config = ConfigDict(extra="ignore")


class TeacherSubjectCreate(_Payload):
    name: str
    code: str
    description: str | None = None


class AdminUserCreate(_Payload):
    email: str
    firstName: str
    lastName: str
    password: str | None = None
    role: Literal["STUDENT", "TEACHER", "ADMIN"] | None = None
    groupId: str | None = None


class AdminUserUpdate(_Payload):
    firstName: str | None = None
    lastName: str | None = None
    password: str | None = None
    role: Literal["STUDENT", "TEACHER", "ADMIN"] | None = None
    isActive: bool | None = None


class GroupCreate(_Payload):
    name: str
    code: str | None = None


class GroupTeacherAssign(_Payload):
    teacherId: str


class AdminSubjectCreate(_Payload):
    name: str
    code: str
    description: str | None = None
    teacherId: str | None = None
    iconName: str | None = None
    color: str | None = None


class TopicCreate(_Payload):
    name: str
    description: str | None = None


class ScheduleItemCreate(_Payload):
    subjectId: str
    groupId: str
    room: str | None = None
    dayOfWeek: int
    startTime: str
    endTime: str
    weekType: str | None = None


ScheduleCreatePayload = Annotated[
    ScheduleItemCreate | list[ScheduleItemCreate],
    Field(description="One schedule item or an array of schedule items."),
]
