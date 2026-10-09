from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ScheduleItemWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    subjectId: str = Field(min_length=1, max_length=100)
    groupId: str = Field(min_length=1, max_length=100)
    dayOfWeek: int = Field(ge=0, le=6, strict=True)
    startTime: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    endTime: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    room: str | None = Field(default=None, max_length=100)
    teacherName: str | None = Field(default=None, max_length=200)
    weekType: Literal["odd", "even"] | None = None
    isActive: bool = Field(default=True, strict=True)

    @field_validator("room", "teacherName", mode="after")
    @classmethod
    def empty_to_none(cls, value):
        return value or None

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.endTime <= self.startTime:
            raise ValueError("Время окончания должно быть позже времени начала")
        return self


class ScheduleClearRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirmation: Literal["CLEAR_SCHEDULE"]
