from app.db.database import prisma
from app.core.utils import parse_db_json

class AchievementsService:
    async def get_achievements(self, user_id: str):
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
