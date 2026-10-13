from fastapi import HTTPException
from app.db.database import prisma
from prisma.enums import Role
from typing import Optional

class TeacherService:
    def _student_filter(self, user_id: str, is_admin: bool):
        where = {"role": Role.STUDENT, "isActive": True}
        if not is_admin:
            where["studentProfile"] = {"is": {"group": {"is": {"teachers": {"some": {"id": user_id}}}}}}
        return where

    async def get_dashboard(self, user_id: str, is_admin: bool):
        where_clause = {} if is_admin else {"teacherId": user_id}
        subjects = await prisma.subject.find_many(
            where=where_clause, # type: ignore
            include={"tests": True}
        )
        subject_ids = [s.id for s in subjects]

        student_filter = self._student_filter(user_id, is_admin)
        total_students = await prisma.user.count(where=student_filter)

        attempts = await prisma.attempt.find_many(
            where={"test": {"is": {"subjectId": {"in": subject_ids}}}, "status": "COMPLETED", "user": {"is": student_filter}}, # type: ignore
            include={
                "user": True,
                "test": {"include": {"subject": True}}
            },
            order={"completedAt": "desc"}
        )


        avg_score = sum(a.percentage or 0 for a in attempts) / len(attempts) if attempts else 0
        recent_attempts = attempts[:20]

        return {
            "subjects": [
                {
                    "id": s.id,
                    "name": s.name,
                    "code": s.code,
                    "description": s.description,
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
        student_filter = self._student_filter(user_id, is_admin)
        if subject_id:
            subject = await prisma.subject.find_unique(where={"id": subject_id})
            if not subject:
                raise HTTPException(404, "Предмет не найден")
            if not is_admin and subject.teacherId != user_id:
                raise HTTPException(403, "Нет доступа к этому предмету")
        where_clause = {"status": "COMPLETED", "user": {"is": student_filter}}
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
            
        for student in await prisma.user.find_many(where=student_filter, include={"studentProfile": {"include": {"group": True}}}):
            student_data_map.setdefault(student.id, {"user": student, "attempts": []})
        res = []
        for sid, data in student_data_map.items():
            user = data["user"]
            s_attempts = data["attempts"]
            
            avg_score = sum(at.percentage or 0 for at in s_attempts) / len(s_attempts) if s_attempts else 0
            
            # weak topics
            weak_topics_where = {"userId": sid, "masteryScore": {"lt": 60}}
            if not is_admin:
                weak_topics_where["topic"] = {"is": {"subject": {"is": {"teacherId": user_id}}}} # type: ignore
                
            if subject_id:
                weak_topics_where["topic"] = {"is": {"subjectId": subject_id}}
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

    async def get_student_detail(self, student_id: str, user_id: str, is_admin: bool):
        user = await prisma.user.find_unique(
            where={"id": student_id},
            include={
                "studentProfile": {"include": {"group": True}}
            }
        )
        if not user:
            raise HTTPException(status_code=404, detail="Student not found")
            
        if user.role != Role.STUDENT:
            raise HTTPException(404, "Student not found")
        if not is_admin:
            allowed = await prisma.user.find_first(where={"id": student_id, "studentProfile": {"is": {"group": {"is": {"teachers": {"some": {"id": user_id}}}}}}})
            if not allowed:
                raise HTTPException(403, "Нет доступа к этому студенту")
        attempt_filter = {"userId": student_id, "status": "COMPLETED"}
        progress_filter = {"userId": student_id}
        if not is_admin:
            attempt_filter["test"] = {"is": {"subject": {"is": {"teacherId": user_id}}}}
            progress_filter["topic"] = {"is": {"subject": {"is": {"teacherId": user_id}}}}
        attempts = await prisma.attempt.find_many(
            where=attempt_filter,
            include={"test": {"include": {"subject": True}}},
            order={"completedAt": "desc"},
            take=20
        )
        
        progress = await prisma.topicprogress.find_many(
            where=progress_filter,
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
