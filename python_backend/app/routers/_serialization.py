"""Small, explicit serializers for the legacy Prisma-shaped API.

SQLAlchemy uses Pythonic ``snake_case`` attributes while the React client was
built against Prisma's ``camelCase`` JSON.  Keeping the conversion here makes
the boundary visible and prevents accidental leaking of private ORM fields
(for example password hashes).
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any


def json_value(value: Any) -> Any:
    """Return a JSON-compatible scalar without changing legacy field names."""

    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (datetime, date)):
        # FastAPI would encode these too, but doing it here also makes the
        # serializers safe when they are used by a service or in tests.
        return value.isoformat()
    if isinstance(value, list):
        return [json_value(item) for item in value]
    if isinstance(value, dict):
        return {key: json_value(item) for key, item in value.items()}
    return value


def fields(instance: Any, **mapping: str) -> dict[str, Any]:
    """Project an ORM instance with explicit API-key -> attribute mappings."""

    return {
        api_name: json_value(getattr(instance, attribute))
        for api_name, attribute in mapping.items()
    }


def user_contact(user: Any) -> dict[str, Any]:
    """The deliberately small User projection returned by messenger contacts."""

    return fields(
        user,
        id="id",
        firstName="first_name",
        lastName="last_name",
        avatarUrl="avatar_url",
    )


def group_data(group: Any, students_count: int | None = None) -> dict[str, Any]:
    """Serialize Group in the same shape Prisma returns for group endpoints."""

    data = fields(
        group,
        id="id",
        name="name",
        code="code",
        createdAt="created_at",
        updatedAt="updated_at",
    )
    if students_count is not None:
        data["_count"] = {"students": students_count}
    return data


def student_profile_data(profile: Any, *, include_user: bool = False) -> dict[str, Any]:
    """Serialize StudentProfile, optionally with the legacy selected user view."""

    data = fields(
        profile,
        id="id",
        userId="user_id",
        groupId="group_id",
        studentCode="student_code",
        xp="xp",
        streak="streak",
        bestStreak="best_streak",
        lastStudyDate="last_study_date",
        dailyGoal="daily_goal",
        createdAt="created_at",
        updatedAt="updated_at",
    )
    if include_user:
        user = profile.user
        data["user"] = fields(
            user,
            id="id",
            firstName="first_name",
            lastName="last_name",
            email="email",
            avatarUrl="avatar_url",
        )
    return data


def message_data(message: Any) -> dict[str, Any]:
    """Serialize a Message exactly as Prisma's default model projection."""

    return fields(
        message,
        id="id",
        senderId="sender_id",
        receiverId="receiver_id",
        content="content",
        isRead="is_read",
        createdAt="created_at",
    )


def lecture_data(lecture: Any, *, include_relations: bool = False) -> dict[str, Any]:
    """Serialize a Lecture and the two nested projections used by GET routes."""

    data = fields(
        lecture,
        id="id",
        title="title",
        content="content",
        groupId="group_id",
        subjectId="subject_id",
        teacherId="teacher_id",
        fileUrl="file_url",
        fileName="file_name",
        createdAt="created_at",
        updatedAt="updated_at",
    )
    if include_relations:
        data["teacher"] = fields(
            lecture.teacher,
            firstName="first_name",
            lastName="last_name",
        )
        data["subject"] = fields(lecture.subject, name="name")
    return data


def schedule_item_data(item: Any, *, detailed_subject: bool) -> dict[str, Any]:
    """Serialize ScheduleItem including the selected Subject and Group fields."""

    data = fields(
        item,
        id="id",
        externalId="external_id",
        subjectId="subject_id",
        groupId="group_id",
        teacherName="teacher_name",
        room="room",
        dayOfWeek="day_of_week",
        startTime="start_time",
        endTime="end_time",
        weekType="week_type",
        isActive="is_active",
        createdAt="created_at",
        updatedAt="updated_at",
    )
    subject_mapping = {
        "id": "id",
        "name": "name",
        "code": "code",
        "color": "color",
    }
    if detailed_subject:
        subject_mapping["iconName"] = "icon_name"
    data["subject"] = fields(item.subject, **subject_mapping)
    data["group"] = fields(item.group, id="id", name="name", code="code")
    return data
