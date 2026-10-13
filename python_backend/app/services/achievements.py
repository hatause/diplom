from app.db.database import prisma
from app.core.utils import parse_db_json
from app.core.config import settings
from zoneinfo import ZoneInfo

class AchievementsService:
    async def award(self, db, user_id: str):
        profile = await db.studentprofile.find_unique(where={"userId": user_id})
        if not profile:
            return
        catalog = await db.achievement.find_many()
        unlocked = {x.achievementId for x in await db.userachievement.find_many(where={"userId": user_id})}
        attempts = await db.attempt.find_many(where={"userId": user_id, "status": "COMPLETED"})
        answers = await db.answer.count(where={"attempt": {"is": {"userId": user_id, "status": "COMPLETED"}}})
        progress = await db.topicprogress.find_many(where={"userId": user_id})
        reward = 0
        for achievement in catalog:
            if achievement.id in unlocked:
                continue
            condition = parse_db_json(achievement.condition) or {}
            kind, value = condition.get("type"), condition.get("value", 1)
            checks = {
                "test_count": len(attempts) >= value,
                "question_count": answers >= value,
                "perfect_score": sum(a.percentage == 100 for a in attempts) >= value,
                "streak": profile.bestStreak >= value,
                "mastery": any(p.masteryScore >= value for p in progress),
                "night_test": any(a.completedAt and a.completedAt.astimezone(ZoneInfo(settings.SCHOOL_TIMEZONE)).hour >= 23 for a in attempts),
                "speed": any(a.totalTime is not None and 0 < a.totalTime <= value for a in attempts),
            }
            if checks.get(kind, False):
                await db.userachievement.create(data={"userId": user_id, "achievementId": achievement.id})
                reward += achievement.xpReward
        if reward:
            await db.studentprofile.update(where={"userId": user_id}, data={"xp": {"increment": reward}})

    async def get_achievements(self, user_id: str):
        async with prisma.tx(timeout=15000) as db:
            await db.query_raw('SELECT id FROM "User" WHERE id = $1 FOR UPDATE', user_id)
            await self.award(db, user_id)

        all_achievements = await prisma.achievement.find_many(
            order={"createdAt": "asc"}
        )
        user_achievements = await prisma.userachievement.find_many(
            where={"userId": user_id}
        )
        profile = await prisma.studentprofile.find_unique(
            where={"userId": user_id}
        )

        unlocked_map = {ua.achievementId: ua.unlockedAt for ua in user_achievements}

        return {
            "achievements": [
                {
                    **a.model_dump(),
                    "title": a.name,
                    "conditionType": parse_db_json(a.condition).get("type"),
                    "conditionValue": parse_db_json(a.condition).get("value"),
                    "isUnlocked": a.id in unlocked_map,
                    "unlockedAt": unlocked_map[a.id].isoformat() if a.id in unlocked_map and unlocked_map[a.id] else None
                } for a in all_achievements
            ],
            "stats": {
                "xp": profile.xp if profile else 0,
                "streak": profile.streak if profile else 0,
                "bestStreak": profile.bestStreak if profile else 0,
                "dailyGoal": profile.dailyGoal if profile else 3,
                "unlockedCount": len(user_achievements),
                "totalCount": len(all_achievements)
            }
        }

achievements_service = AchievementsService()
