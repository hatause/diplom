from app.db.database import prisma
from datetime import datetime, timezone

class ReviewService:
    async def get_due_topics(self, user_id: str):
        now = datetime.now(timezone.utc)
        due_topics = await prisma.topicprogress.find_many(
            where={
                "userId": user_id,
                "topic": {"is": {"subject": {"is": {"isActive": True}}}},
                "OR": [
                    {"nextReviewAt": {"lte": now}},
                    {"masteryScore": {"lt": 60}}
                ]
            },
            include={
                "topic": {
                    "include": {
                        "subject": True
                    }
                }
            },
            order=[
                {"nextReviewAt": "asc"}, # type: ignore
                {"masteryScore": "asc"} # type: ignore
            ]
        )

        return [
            {
                "id": tp.id,
                "topicId": tp.topicId,
                "topicName": tp.topic.name if tp.topic else "Unknown",
                "subjectId": tp.topic.subject.id if tp.topic and tp.topic.subject else None,
                "subjectName": tp.topic.subject.name if tp.topic and tp.topic.subject else "Unknown",
                "subjectColor": tp.topic.subject.color if tp.topic and tp.topic.subject else "blue",
                "masteryScore": round(tp.masteryScore),
                "masteryLevel": tp.masteryLevel,
                "lastStudiedAt": tp.lastStudiedAt.isoformat() if tp.lastStudiedAt else None,
                "nextReviewAt": tp.nextReviewAt.isoformat() if tp.nextReviewAt else None,
                "reviewInterval": tp.reviewInterval,
                "isOverdue": (tp.nextReviewAt <= now) if tp.nextReviewAt else True
            }
            for tp in due_topics
        ]

review_service = ReviewService()
