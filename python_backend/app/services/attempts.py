from fastapi import HTTPException
from app.db.database import prisma
from typing import Optional
from app.core.utils import parse_db_json

class AttemptsService:
    async def get_user_attempts(self, user_id: str, status: Optional[str] = None, subject_id: Optional[str] = None, page: int = 1, limit: int = 20):
        where_clause = {"userId": user_id}
        if status:
            where_clause["status"] = status
        if subject_id:
            where_clause["test"] = {"is": {"subjectId": subject_id}}

        limit = min(limit, 50)
        skip = (page - 1) * limit

        attempts = await prisma.attempt.find_many(
            where=where_clause, # type: ignore
            include={
                "test": {
                    "include": {
                        "subject": True
                    }
                }
            },
            order={"createdAt": "desc"},
            take=limit,
            skip=skip
        )
        total = await prisma.attempt.count(where=where_clause) # type: ignore

        results = []
        for a in attempts:
            results.append({
                "id": a.id,
                "testId": a.testId,
                "testTitle": a.test.title if a.test else None,
                "subject": {"id": a.test.subject.id, "name": a.test.subject.name, "color": a.test.subject.color} if a.test and a.test.subject else None,
                "topic": a.test.topic if a.test else None,
                "difficulty": a.test.difficulty if a.test else None,
                "status": a.status,
                "score": a.score,
                "percentage": a.percentage,
                "correctCount": a.correctCount,
                "wrongCount": a.wrongCount,
                "skippedCount": a.skippedCount,
                "questionCount": a.test.questionCount if a.test else 0,
                "totalTime": a.totalTime,
                "startedAt": a.startedAt.isoformat() if a.startedAt else None,
                "completedAt": a.completedAt.isoformat() if a.completedAt else None,
            })
            
        return {
            "attempts": results,
            "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
        }

    async def get_attempt_detail(self, attempt_id: str, user_id: str):
        attempt = await prisma.attempt.find_unique(
            where={"id": attempt_id},
            include={
                "test": {
                    "include": {
                        "subject": True,
                        "questions": {"orderBy": {"orderIndex": "asc"}}
                    }
                },
                "answers": True
            }
        ) # type: ignore

        if not attempt or attempt.userId != user_id:
            raise HTTPException(status_code=404, detail="Attempt not found")

        show_answers = attempt.status == "COMPLETED"

        att_dict = attempt.model_dump()
        att_dict["savedProgress"] = parse_db_json(att_dict.get("savedProgress"))
        if att_dict.get("test") and att_dict["test"].get("questions"):
            for q in att_dict["test"]["questions"]:
                q["options"] = parse_db_json(q.get("options")) if q.get("options") else []
                if not show_answers:
                    q.pop("correctAnswer", None)
                    q.pop("explanation", None)
                else:
                    q["correctAnswer"] = parse_db_json(q.get("correctAnswer")) if q.get("correctAnswer") else None
        
        if att_dict.get("test") and att_dict["test"].get("subject"):
            att_dict["test"]["subject"] = {
                "id": att_dict["test"]["subject"]["id"],
                "name": att_dict["test"]["subject"]["name"]
            }

        if att_dict.get("answers"):
            for ans in att_dict["answers"]:
                ans["userAnswer"] = parse_db_json(ans.get("userAnswer")) if ans.get("userAnswer") else None

        return att_dict

    async def get_attempt_result(self, attempt_id: str, user_id: str):
        attempt = await prisma.attempt.find_unique(
            where={"id": attempt_id},
            include={
                "test": {
                    "include": {
                        "subject": True,
                        "questions": {"orderBy": {"orderIndex": "asc"}}
                    }
                },
                "answers": {
                    "include": {"question": True}
                }
            }
        ) # type: ignore

        if not attempt or attempt.userId != user_id:
            raise HTTPException(status_code=404, detail="Attempt not found")
        if attempt.status != "COMPLETED":
            raise HTTPException(status_code=400, detail="Attempt not yet completed")

        enriched_answers = []
        if attempt.answers:
            for ans in attempt.answers:
                question = ans.question
                enriched_answers.append({
                    "questionId": ans.questionId,
                    "question": question.question if question else None,
                    "type": question.type if question else None,
                    "options": parse_db_json(question.options) if question and question.options else [],
                    "userAnswer": parse_db_json(ans.userAnswer) if ans.userAnswer else None,
                    "correctAnswer": parse_db_json(question.correctAnswer) if question and question.correctAnswer else None,
                    "isCorrect": ans.isCorrect,
                    "explanation": question.explanation if question else None,
                    "timeSpent": ans.timeSpent
                })

        return {
            "id": attempt.id,
            "test": {
                "id": attempt.test.id if attempt.test else None,
                "title": attempt.test.title if attempt.test else None,
                "subject": {"id": attempt.test.subject.id, "name": attempt.test.subject.name} if attempt.test and attempt.test.subject else None,
                "topic": attempt.test.topic if attempt.test else None,
                "difficulty": attempt.test.difficulty if attempt.test else None,
            },
            "score": attempt.score,
            "percentage": attempt.percentage,
            "correctCount": attempt.correctCount,
            "wrongCount": attempt.wrongCount,
            "skippedCount": attempt.skippedCount,
            "totalTime": attempt.totalTime,
            "startedAt": attempt.startedAt.isoformat() if attempt.startedAt else None,
            "completedAt": attempt.completedAt.isoformat() if attempt.completedAt else None,
            "answers": enriched_answers,
            "aiAnalysis": parse_db_json(attempt.aiAnalysis)
        }

attempts_service = AttemptsService()
