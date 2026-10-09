"""Seed the achievement catalog; --demo also adds the former Node seed's demo data.

Run explicitly: python scripts/seed.py [--demo]. Existing records and passwords
are preserved. The application never seeds or changes the schema on startup.
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # Load the same environment as the server.
from app.db.database import prisma
from app.services.auth import hash_password
from prisma import Json


ACHIEVEMENTS = [
    ("FIRST_TEST", "Первый тест", "Пройдите ваш первый тест", "Trophy", 50, "test_count", 1),
    ("TEN_TESTS", "10 тестов", "Пройдите 10 тестов", "Award", 100, "test_count", 10),
    ("HUNDRED_QUESTIONS", "100 вопросов", "Ответьте на 100 вопросов", "HelpCircle", 150, "question_count", 100),
    ("PERFECT_SCORE", "Идеально!", "Получите 100% на тесте", "Star", 100, "perfect_score", 1),
    ("WEEK_STREAK", "Недельная серия", "7 дней подряд обучения", "Flame", 200, "streak", 7),
    ("MASTERED_TOPIC", "Мастер темы", "Достигните уровня Mastered по любой теме", "GraduationCap", 300, "mastery", 95),
    ("NIGHT_OWL", "Сова", "Пройдите тест после 23:00", "Moon", 50, "night_test", 1),
    ("SPEED_DEMON", "Скоростной", "Пройдите тест менее чем за 2 минуты", "Zap", 75, "speed", 120),
]

GROUPS = [
    ("CS-101", "Информатика 1 курс"),
    ("CS-201", "Информатика 2 курс"),
    ("MATH-101", "Математика 1 курс"),
]

USERS = [
    ("admin@aitutor.com", "Админ", "Системный", "ADMIN"),
    ("petrov@aitutor.com", "Пётр", "Петров", "TEACHER"),
    ("sidorova@aitutor.com", "Елена", "Сидорова", "TEACHER"),
    ("student@aitutor.com", "Иван", "Иванов", "STUDENT"),
    ("maria@aitutor.com", "Мария", "Козлова", "STUDENT"),
]

SUBJECTS = [
    ("MATH_ANALYSIS", "Математический анализ", "Пределы, производные, интегралы, ряды", "petrov@aitutor.com", "#10B981", "Calculator",
     ["Пределы", "Производные", "Интегралы", "Ряды", "Дифференциальные уравнения"]),
    ("LINEAR_ALGEBRA", "Линейная алгебра", "Матрицы, определители, системы уравнений, векторные пространства", "petrov@aitutor.com", "#6366F1", "Grid3x3",
     ["Матрицы", "Определители", "Системы линейных уравнений", "Векторные пространства", "Линейные преобразования"]),
    ("PROGRAMMING", "Программирование", "Основы алгоритмов, структуры данных, ООП", "sidorova@aitutor.com", "#F59E0B", "Code",
     ["Алгоритмы", "Структуры данных", "ООП", "Паттерны проектирования", "Базы данных"]),
    ("PHYSICS", "Физика", "Механика, термодинамика, электричество", "sidorova@aitutor.com", "#EF4444", "Atom",
     ["Механика", "Термодинамика", "Электричество", "Оптика", "Квантовая физика"]),
    ("DISCRETE_MATH", "Дискретная математика", "Логика, комбинаторика, графы, автоматы", "petrov@aitutor.com", "#8B5CF6", "Shapes",
     ["Математическая логика", "Комбинаторика", "Теория графов", "Автоматы", "Теория множеств"]),
]

SCHEDULE = [
    ("MATH_ANALYSIS", 1, "09:00", "10:30", "А-301"),
    ("PROGRAMMING", 1, "10:45", "12:15", "Б-215"),
    ("LINEAR_ALGEBRA", 2, "09:00", "10:30", "А-301"),
    ("PHYSICS", 2, "10:45", "12:15", "В-102"),
    ("DISCRETE_MATH", 3, "09:00", "10:30", "А-205"),
    ("MATH_ANALYSIS", 3, "10:45", "12:15", "А-301"),
    ("PROGRAMMING", 4, "09:00", "10:30", "Б-215"),
    ("LINEAR_ALGEBRA", 4, "13:00", "14:30", "А-301"),
    ("PHYSICS", 5, "09:00", "10:30", "В-102"),
    ("DISCRETE_MATH", 5, "10:45", "12:15", "А-205"),
]


async def seed_catalog(db):
    for code, name, description, icon, xp, kind, value in ACHIEVEMENTS:
        await db.achievement.upsert(
            where={"code": code},
            data={"create": {
                "code": code, "name": name, "description": description,
                "iconName": icon, "xpReward": xp,
                "condition": Json({"type": kind, "value": value}),
            }, "update": {}},
        )


async def seed_demo(db):
    groups = {}
    for code, name in GROUPS:
        groups[code] = await db.group.upsert(
            where={"code": code}, data={"create": {"code": code, "name": name}, "update": {}},
        )

    users = {}
    password_hash = hash_password("password123")
    for email, first, last, role in USERS:
        data = {"email": email, "firstName": first, "lastName": last, "role": role, "passwordHash": password_hash}
        if role == "STUDENT":
            xp, streak, best = (250, 3, 7) if email == "student@aitutor.com" else (180, 1, 5)
            data["studentProfile"] = {"create": {
                "groupId": groups["CS-101"].id, "xp": xp, "streak": streak, "bestStreak": best,
            }}
        users[email] = await db.user.upsert(where={"email": email}, data={"create": data, "update": {}})

    subjects = {}
    for code, name, description, teacher, color, icon, topics in SUBJECTS:
        subject = await db.subject.upsert(where={"code": code}, data={"create": {
            "code": code, "name": name, "description": description,
            "teacherId": users[teacher].id, "color": color, "iconName": icon,
        }, "update": {}})
        subjects[code] = subject
        for index, topic in enumerate(topics):
            await db.topic.upsert(
                where={"subjectId_name": {"subjectId": subject.id, "name": topic}},
                data={"create": {"subjectId": subject.id, "name": topic, "orderIndex": index}, "update": {}},
            )

    for code, day, start, end, room in SCHEDULE:
        subject = subjects[code]
        slot = {"subjectId": subject.id, "groupId": groups["CS-101"].id,
                "dayOfWeek": day, "startTime": start, "endTime": end}
        # Also recognize records made by the old seed; do not duplicate them.
        if not await db.scheduleitem.find_first(where=slot):
            teacher = await db.user.find_unique(where={"id": subject.teacherId}) if subject.teacherId else None
            await db.scheduleitem.create(data={
                **slot, "room": room,
                "teacherName": f"{teacher.firstName} {teacher.lastName}" if teacher else None,
            })


async def main(demo=False):
    await prisma.connect()
    try:
        async with prisma.tx(timeout=30000) as db:
            await seed_catalog(db)
            if demo:
                await seed_demo(db)
    finally:
        await prisma.disconnect()
    print("Achievement catalog initialized; existing data preserved.")
    if demo:
        print("Demo data initialized. New demo accounts use password123; existing passwords are unchanged.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--demo", action="store_true", help="Also add demo users, courses and schedule")
    asyncio.run(main(parser.parse_args().demo))
