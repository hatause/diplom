from app.db.database import prisma
from typing import Optional

class SubjectsService:
    async def get_all_subjects(self, user_id: str):
        subjects = await prisma.subject.find_many(
            where={"isActive": True},
            include={
                "topics": {"orderBy": {"orderIndex": "asc"}},
                "teacher": True,
                "tests": True
            },
            order={"name": "asc"}
        )

        enriched = []
        for subject in subjects:
            attempts = await prisma.attempt.find_many(
                where={
                    "userId": user_id, 
                    "test": {"is": {"subjectId": subject.id}},
                    "status": "COMPLETED"
                },
                order={"completedAt": "desc"},
                take=10
            )
            
            avg_score = 0
            if attempts:
                avg_score = sum(a.percentage or 0 for a in attempts) / len(attempts)
                
            progress = await prisma.topicprogress.find_many(
                where={
                    "userId": user_id,
                    "topic": {"is": {"subjectId": subject.id}}
                },
                include={"topic": True}
            )
            
            weak_topics = []
            overall_mastery = 0
            if progress:
                for p in progress:
                    if p.masteryScore < 60:
                        weak_topics.append({"name": p.topic.name, "score": round(p.masteryScore)})
                overall_mastery = sum(p.masteryScore for p in progress) / len(progress)

            enriched.append({
                "id": subject.id,
                "name": subject.name,
                "code": subject.code,
                "description": subject.description,
                "iconName": subject.iconName,
                "color": subject.color,
                "teacher": f"{subject.teacher.firstName} {subject.teacher.lastName}" if subject.teacher else None,
                "topicCount": len(subject.topics) if subject.topics else 0,
                "topics": [t.model_dump() for t in (subject.topics or [])],
                "testCount": len(subject.tests) if getattr(subject, "tests", None) else 0,
                "avgScore": round(avg_score),
                "mastery": round(overall_mastery),
                "weakTopics": weak_topics,
                "attemptsCount": len(attempts),
                "lastActivity": attempts[0].completedAt.isoformat() if attempts and attempts[0].completedAt else None
            })
            
        return enriched

    async def get_subject_by_id(self, subject_id: str, user_id: str):
        subject = await prisma.subject.find_unique(
            where={"id": subject_id},
            include={
                "topics": {
                    "orderBy": {"orderIndex": "asc"},
                    "include": {
                        "topicProgress": {"where": {"userId": user_id}, "take": 1}
                    }
                },
                "teacher": True
            }
        )
        if not subject:
            return None
            
        s_dict = subject.model_dump()
        if s_dict.get("teacher"):
            s_dict["teacher"].pop("passwordHash", None)
        return s_dict

subjects_service = SubjectsService()
