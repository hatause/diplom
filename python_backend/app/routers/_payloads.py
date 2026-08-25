"""Pydantic request contracts for the supplementary legacy endpoints."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class LegacyPayload(BaseModel):
    """Zod objects ignored unknown keys, so the Python boundary does as well."""

    model_config = ConfigDict(extra="ignore")


class GroupCreatePayload(LegacyPayload):
    name: str = Field(min_length=1)
    code: str = Field(min_length=1)


class GroupStudentAssignPayload(LegacyPayload):
    # The TypeScript handler performs its own required-field response.  Keeping
    # this optional lets us retain its `{ success: false, error: ... }` shape.
    studentId: str | None = None


class SendMessagePayload(LegacyPayload):
    receiverId: str
    content: str = Field(min_length=1)


class LectureCreatePayload(LegacyPayload):
    title: str
    content: str
    groupId: str | None = None
    subjectId: str
    fileUrl: str | None = None
    fileName: str | None = None


class PushScheduleItemPayload(LegacyPayload):
    """The push provider tolerates sparse external data and fills defaults."""

    id: str | int | None = None
    externalScheduleId: str | int | None = None
    subjectName: str | None = None
    subName: str | None = None
    teacherName: str | None = None
    groupCode: str | None = None
    room: str | None = None
    dayOfWeek: int | None = None
    startTime: str | None = None
    endTime: str | None = None
    weekType: str | None = None
    startsAt: str | None = None
    endsAt: str | None = None

    def provider_data(self) -> dict[str, Any]:
        """Return the unaliased mapping consumed by the schedule provider."""

        return self.model_dump(exclude_none=False)
