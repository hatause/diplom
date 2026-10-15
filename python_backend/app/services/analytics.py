from app.db.database import prisma
from app.core.config import settings
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

class AnalyticsService:
    async def get_overall_analytics(self, user_id: str):
        school_zone = ZoneInfo(settings.SCHOOL_TIMEZONE)
        total_attempts = await prisma.attempt.count(where={"userId": user_id})
        completed_attempts = await prisma.attempt.count(where={"userId": user_id, "status": "COMPLETED"})
        
        # Calculate average score manually if aggregate is tricky in pyprisma
        attempts = await prisma.attempt.find_many(
            where={"userId": user_id, "status": "COMPLETED"}
        )
        avg_score = sum(a.percentage or 0 for a in attempts) / len(attempts) if attempts else 0

        topic_progress = await prisma.topicprogress.find_many(
            where={"userId": user_id},
            include={
                "topic": {
                    "include": {
                        "subject": True
                    }
                }
            },
            order={"masteryScore": "asc"}
        )

        recent_sessions = await prisma.studysession.find_many(
            where={"userId": user_id},
            order={"createdAt": "desc"},
            take=30
        )

        profile = await prisma.studentprofile.find_unique(where={"userId": user_id})

        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        progress_over_time = [
            a for a in attempts if a.completedAt and a.completedAt >= thirty_days_ago
        ]
        progress_over_time.sort(key=lambda x: x.completedAt) # type: ignore

        overview = {
            "totalAttempts": total_attempts,
            "completedAttempts": completed_attempts,
            "avgScore": round(avg_score),
            "xp": profile.xp if profile else 0,
            "streak": profile.streak if profile else 0,
            "bestStreak": profile.bestStreak if profile else 0,
        }

        return {
            "overview": overview,
            "topicProgress": [
                {
                    "id": tp.id,
                    "topicName": tp.topic.name,
                    "subjectName": tp.topic.subject.name,
                    "subjectColor": tp.topic.subject.color,
                    "masteryScore": round(tp.masteryScore),
                    "masteryLevel": tp.masteryLevel,
                    "totalAttempts": tp.totalAttempts,
                    "correctAnswers": tp.correctAnswers,
                    "wrongAnswers": tp.wrongAnswers,
                    "lastStudiedAt": tp.lastStudiedAt.isoformat() if tp.lastStudiedAt else None,
                    "nextReviewAt": tp.nextReviewAt.isoformat() if tp.nextReviewAt else None,
                } for tp in topic_progress if tp.topic and tp.topic.subject
            ],
            "progressOverTime": [
                {
                    "date": p.completedAt.astimezone(school_zone).date().isoformat() if p.completedAt else None,
                    "score": p.percentage,
                } for p in progress_over_time
            ],
            "studyActivity": [
                {
                    "date": s.createdAt.astimezone(school_zone).date().isoformat(),
                    "type": s.activityType,
                    "duration": s.duration,
                    "xpEarned": s.xpEarned,
                } for s in recent_sessions
            ]
        }

    async def get_subject_analytics(self, user_id: str):
        subjects = await prisma.subject.find_many(where={"isActive": True})
        stats = []

        attempts = await prisma.attempt.find_many(
            where={"userId": user_id, "status": "COMPLETED"},
            include={"test": True}
        )

        for subject in subjects:
            subj_attempts = [a for a in attempts if a.test and a.test.subjectId == subject.id]
            if not subj_attempts:
                continue

            avg_score = sum(a.percentage or 0 for a in subj_attempts) / len(subj_attempts)
            
            stats.append({
                "subjectId": subject.id,
                "subjectName": subject.name,
                "color": subject.color,
                "avgScore": round(avg_score),
                "testCount": len(subj_attempts)
            })

        return stats

    async def get_topic_analytics(self, user_id: str, subject_id: str = None):
        where_clause = {"userId": user_id}
        if subject_id:
            where_clause["topic"] = {"is": {"subjectId": subject_id}} # type: ignore

        progress = await prisma.topicprogress.find_many(
            where=where_clause, # type: ignore
            include={
                "topic": {
                    "include": {
                        "subject": True
                    }
                }
            },
            order={"masteryScore": "asc"}
        )

        return [
            {
                "topicName": p.topic.name,
                "subjectName": p.topic.subject.name,
                "masteryScore": round(p.masteryScore),
                "masteryLevel": p.masteryLevel,
                "totalAttempts": p.totalAttempts,
                "correctAnswers": p.correctAnswers,
                "wrongAnswers": p.wrongAnswers,
            } for p in progress if p.topic and p.topic.subject
        ]

analytics_service = AnalyticsService()
