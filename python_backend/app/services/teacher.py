from fastapi import HTTPException
from app.db.database import prisma
from prisma.enums import Role
from typing import Optional

class TeacherService:
    async def get_dashboard(self, user_id: str, is_admin: bool):
        where_clause = {} if is_admin else {"teacherId": user_id}
        subjects = await prisma.subject.find_many(
            where=where_clause, # type: ignore
            include={"tests": True}
        )
        subject_ids = [s.id for s in subjects]

        if not subject_ids:
            return {
                "subjects": [],
                "totalStudents": 0,
                "avgScore": 0,
                "recentAttempts": []
            }

        attempts = await prisma.attempt.find_many(
            where={"test": {"is": {"subjectId": {"in": subject_ids}}}, "status": "COMPLETED"}, # type: ignore
            include={
                "user": True,
                "test": {"include": {"subject": True}}
            },
            order={"completedAt": "desc"}
        )

        unique_student_ids = {a.userId for a in attempts}
        total_students = len(unique_student_ids)

        avg_score = sum(a.percentage or 0 for a in attempts) / len(attempts) if attempts else 0
        recent_attempts = attempts[:20]

        return {
            "subjects": [
                {
                    "id": s.id,
                    "name": s.name,
                    "testCount": len(s.tests) if s.tests else 0
                } for s in subjects
            ],
            "totalStudents": total_students,
            "avgScore": round(avg_score),
            "recentAttempts": [
                {
                    "studentName": f"{a.user.firstName} {a.user.lastName}" if a.user else "Unknown",
                    "testTitle": a.test.title if a.test else "Unknown",
                    "subject": a.test.subject.name if a.test and a.test.subject else "Unknown",
                    "difficulty": a.test.difficulty if a.test else "medium",
                    "score": a.percentage,
                    "completedAt": a.completedAt.isoformat() if a.completedAt else None
                } for a in recent_attempts
            ]
        }

    async def get_students(self, user_id: str, is_admin: bool, subject_id: Optional[str] = None):
        where_clause = {"status": "COMPLETED"}
        if not is_admin:
            where_clause["test"] = {"is": {"subject": {"is": {"teacherId": user_id}}}} # type: ignore
        
        if subject_id:
            if "test" not in where_clause:
                where_clause["test"] = {"is": {}} # type: ignore
            where_clause["test"]["is"]["subjectId"] = subject_id # type: ignore
            
        attempts = await prisma.attempt.find_many(
            where=where_clause, # type: ignore
            include={
                "user": {
                    "include": {
                        "studentProfile": {
                            "include": {"group": True}
                        }
                    }
                }
            }
        )
        
        student_data_map = {}
        for a in attempts:
            if not a.user: continue
            sid = a.userId
            if sid not in student_data_map:
                student_data_map[sid] = {
                    "user": a.user,
                    "attempts": []
                }
            student_data_map[sid]["attempts"].append(a)
            
        res = []
        for sid, data in student_data_map.items():
            user = data["user"]
            s_attempts = data["attempts"]
            
            avg_score = sum(at.percentage or 0 for at in s_attempts) / len(s_attempts)
            
            # weak topics
            weak_topics_where = {"userId": sid, "masteryScore": {"lt": 60}}
            if not is_admin:
                weak_topics_where["topic"] = {"is": {"subject": {"is": {"teacherId": user_id}}}} # type: ignore
                
            weak_topics = await prisma.topicprogress.find_many(
                where=weak_topics_where, # type: ignore
                include={"topic": True},
                take=5
            )
            
            group_name = None
            if user.studentProfile and user.studentProfile.group:
                group_name = user.studentProfile.group.name
                
            res.append({
                "id": user.id,
                "name": f"{user.firstName} {user.lastName}",
                "email": user.email,
                "group": group_name,
                "avgScore": round(avg_score),
                "testCount": len(s_attempts),
                "weakTopics": [wt.topic.name for wt in weak_topics if wt.topic]
            })
            
        return res

    async def get_student_detail(self, student_id: str):
        user = await prisma.user.find_unique(
            where={"id": student_id},
            include={
                "studentProfile": {"include": {"group": True}}
            }
        )
        if not user:
            raise HTTPException(status_code=404, detail="Student not found")
            
        attempts = await prisma.attempt.find_many(
            where={"userId": student_id, "status": "COMPLETED"},
            include={"test": {"include": {"subject": True}}},
            order={"completedAt": "desc"},
            take=20
        )
        
        progress = await prisma.topicprogress.find_many(
            where={"userId": student_id},
            include={"topic": {"include": {"subject": True}}}
        )
        
        user_dict = user.model_dump()
        user_dict.pop("passwordHash", None)
        
        return {
            "student": user_dict,
            "attempts": [
                {
                    "testTitle": a.test.title if a.test else "Unknown",
                    "subject": a.test.subject.name if a.test and a.test.subject else "Unknown",
                    "score": a.percentage,
                    "difficulty": a.test.difficulty if a.test else "medium",
                    "completedAt": a.completedAt.isoformat() if a.completedAt else None
                } for a in attempts
            ],
            "progress": [
                {
                    "topic": p.topic.name if p.topic else "Unknown",
                    "subject": p.topic.subject.name if p.topic and p.topic.subject else "Unknown",
                    "mastery": round(p.masteryScore),
                    "level": p.masteryLevel
                } for p in progress
            ]
        }

teacher_service = TeacherService()
