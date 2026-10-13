from app.db.database import prisma
from app.schemas.admin import UserCreate, UserUpdate, GroupCreate, GroupTeacherAdd, SubjectCreate, TopicCreate
from app.services.auth import hash_password
from prisma.enums import Role
from prisma import Json
from prisma.errors import UniqueViolationError, ForeignKeyViolationError
from fastapi import HTTPException
from typing import Optional
import math

class AdminService:
    async def get_users(self, page: int = 1, limit: int = 20, search: str = "", role: Optional[Role] = None):
        skip = (page - 1) * limit
        
        where_clause = {}
        if search:
            where_clause["OR"] = [
                {"email": {"contains": search, "mode": "insensitive"}},
                {"firstName": {"contains": search, "mode": "insensitive"}},
                {"lastName": {"contains": search, "mode": "insensitive"}},
            ]
        if role:
            where_clause["role"] = role

        users = await prisma.user.find_many(
            where=where_clause,
            include={"studentProfile": {"include": {"group": True}}},
            order={"createdAt": "desc"},
            take=limit,
            skip=skip
        )
        
        total = await prisma.user.count(where=where_clause)
        
        safe_users = []
        for user in users:
            u_dict = user.model_dump()
            u_dict.pop("passwordHash", None)
            safe_users.append(u_dict)
            
        return {
            "users": safe_users,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": math.ceil(total / limit) if limit > 0 else 0
            }
        }

    async def create_user(self, data: UserCreate):
        password_hash = hash_password(data.password)
        
        if data.groupId and not await prisma.group.find_unique(where={"id": data.groupId}):
            raise HTTPException(400, "Группа не найдена")
        if await prisma.user.find_first(where={"email": {"equals": data.email, "mode": "insensitive"}}):
            raise HTTPException(409, "Пользователь с таким email уже существует")
        student_profile = {"create": {}} if data.role == Role.STUDENT else None
        if data.role == Role.STUDENT and data.groupId:
            student_profile = {
                "create": {
                    "groupId": data.groupId
                }
            }
        
        user_data = {
            "email": data.email,
            "passwordHash": password_hash,
            "firstName": data.firstName,
            "lastName": data.lastName,
            "role": data.role,
        }
        if student_profile:
            user_data["studentProfile"] = student_profile
            
        try:
            user = await prisma.user.create(data=user_data)
        except UniqueViolationError:
            raise HTTPException(409, "Пользователь с таким email уже существует")
        safe_user = user.model_dump()
        safe_user.pop("passwordHash", None)
        return safe_user

    async def update_user(self, admin_id: str, user_id: str, data: UserUpdate):
        update_data = {}
        if data.firstName is not None: update_data["firstName"] = data.firstName
        if data.lastName is not None: update_data["lastName"] = data.lastName
        if data.role is not None: update_data["role"] = data.role
        if data.isActive is not None: update_data["isActive"] = data.isActive
        if data.password: update_data["passwordHash"] = hash_password(data.password)

        async with prisma.tx() as db:
            await db.query_raw('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext($1))', 'admin-role-changes')
            current = await db.user.find_unique(where={"id": user_id})
            if not current:
                raise HTTPException(404, "Пользователь не найден")
            removing_admin = current.role == Role.ADMIN and (data.role not in (None, Role.ADMIN) or data.isActive is False)
            if removing_admin and (user_id == admin_id or await db.user.count(where={"role": Role.ADMIN, "isActive": True}) <= 1):
                raise HTTPException(400, "Нельзя отключить свой аккаунт администратора или последнего администратора")
            user = await db.user.update(where={"id": user_id}, data=update_data)
            if user.role == Role.STUDENT:
                await db.studentprofile.upsert(where={"userId": user_id}, data={"create": {"userId": user_id}, "update": {}})
            if data.password or data.isActive is False or data.role is not None:
                await db.refreshtoken.delete_many(where={"userId": user_id})
            await db.auditlog.create(data={"userId": admin_id, "action": "UPDATE_USER", "entity": "User", "entityId": user_id, "details": Json({"changes": list(update_data.keys())})})
        safe_user = user.model_dump()
        safe_user.pop("passwordHash", None)
        return safe_user

    async def deactivate_user(self, admin_id: str, user_id: str):
        await self.update_user(admin_id, user_id, UserUpdate(isActive=False))
        return {"success": True}

    async def get_groups(self):
        groups = await prisma.group.find_many(
            include={"students": True, "scheduleItems": True},
            order={"name": "asc"}
        )
        res = []
        for g in groups:
            g_dict = g.model_dump()
            g_dict["_count"] = {
                "students": len(g.students) if g.students else 0,
                "scheduleItems": len(g.scheduleItems) if g.scheduleItems else 0
            }
            g_dict.pop("students", None)
            g_dict.pop("scheduleItems", None)
            res.append(g_dict)
        return res

    async def create_group(self, data: GroupCreate):
        if await prisma.group.find_unique(where={"code": data.code or data.name}):
            raise HTTPException(409, "Группа с таким кодом уже существует")
        group = await prisma.group.create(
            data={
                "name": data.name,
                "code": data.code or data.name
            }
        )
        return group.model_dump()

    async def add_teacher_to_group(self, group_id: str, teacher_id: str):
        if not await prisma.group.find_unique(where={"id": group_id}):
            raise HTTPException(404, "Группа не найдена")
        teacher = await prisma.user.find_unique(where={"id": teacher_id})
        if not teacher or teacher.role != Role.TEACHER or not teacher.isActive:
            raise HTTPException(400, "Выберите действующего преподавателя")
        group = await prisma.group.update(
            where={"id": group_id},
            data={
                "teachers": {"connect": [{"id": teacher_id}]}
            }
        )
        return group.model_dump()

    async def get_subjects(self):
        subjects = await prisma.subject.find_many(
            include={
                "teacher": True,
                "topics": True,
                "tests": True
            },
            order={"name": "asc"}
        )
        
        res = []
        for s in subjects:
            s_dict = s.model_dump()
            if s_dict.get("teacher"):
                s_dict["teacher"].pop("passwordHash", None)
            if s_dict.get("tests") is not None:
                s_dict["_count"] = {"tests": len(s_dict["tests"])}
                s_dict.pop("tests", None)
            res.append(s_dict)
        return res

    async def create_subject(self, data: SubjectCreate):
        if data.teacherId:
            teacher = await prisma.user.find_unique(where={"id": data.teacherId})
            if not teacher or teacher.role != Role.TEACHER or not teacher.isActive:
                raise HTTPException(400, "Выберите действующего преподавателя")
        try:
            subject = await prisma.subject.create(data=data.model_dump())
        except UniqueViolationError:
            raise HTTPException(409, "Предмет с таким кодом уже существует")
        except ForeignKeyViolationError:
            raise HTTPException(400, "Выбранный преподаватель больше не существует")
        return subject.model_dump()

    async def create_topic(self, subject_id: str, data: TopicCreate):
        if not await prisma.subject.find_unique(where={"id": subject_id}):
            raise HTTPException(404, "Предмет не найден")
        if await prisma.topic.find_first(where={"subjectId": subject_id, "name": data.name}):
            raise HTTPException(409, "Тема с таким названием уже существует")
        topic = await prisma.topic.create(
            data={
                "name": data.name,
                "description": data.description,
                "subjectId": subject_id
            }
        )
        return topic.model_dump()

    async def get_dashboard_stats(self):
        user_count = await prisma.user.count()
        student_count = await prisma.user.count(where={"role": Role.STUDENT})
        teacher_count = await prisma.user.count(where={"role": Role.TEACHER})
        subject_count = await prisma.subject.count()
        test_count = await prisma.test.count()
        attempt_count = await prisma.attempt.count(where={"status": "COMPLETED"})

        return {
            "userCount": user_count,
            "studentCount": student_count,
            "teacherCount": teacher_count,
            "subjectCount": subject_count,
            "testCount": test_count,
            "attemptCount": attempt_count
        }

admin_service = AdminService()
