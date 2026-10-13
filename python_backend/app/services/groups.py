from fastapi import HTTPException
from app.db.database import prisma
from app.schemas.groups import GroupCreate, StudentAssign
from prisma.enums import Role
from app.services.access import require_group_access

class GroupsService:
    async def get_my_groups(self, user_id: str, is_admin: bool):
        where_clause = {}
        if not is_admin:
            where_clause = {
                "teachers": {
                    "some": {
                        "id": user_id
                    }
                }
            }
        
        groups = await prisma.group.find_many(
            where=where_clause if where_clause else None, # type: ignore
            include={
                "students": True
            },
            order={"createdAt": "desc"}
        )
        
        res = []
        for g in groups:
            g_dict = g.model_dump()
            g_dict["_count"] = {"students": len(g.students) if g.students else 0}
            g_dict.pop("students", None)
            res.append(g_dict)
            
        return res

    async def create_group(self, user_id: str, data: GroupCreate):
        existing = await prisma.group.find_unique(where={"code": data.code})
        if existing:
            raise HTTPException(status_code=409, detail="Group code already in use")
            
        group = await prisma.group.create(
            data={
                "name": data.name,
                "code": data.code,
                "teachers": {
                    "connect": [{"id": user_id}]
                }
            },
            include={
                "students": True
            }
        ) # type: ignore
        
        g_dict = group.model_dump()
        g_dict["_count"] = {"students": len(group.students) if group.students else 0}
        g_dict.pop("students", None)
        return g_dict

    async def get_group_students(self, group_id: str, user_id: str, role: Role):
        if role == Role.TEACHER:
            has_access = await prisma.group.find_first(
                where={
                    "id": group_id,
                    "teachers": {
                        "some": {"id": user_id}
                    }
                }
            )
            if not has_access:
                raise HTTPException(status_code=403, detail="You do not have access to this group")
                
        students = await prisma.studentprofile.find_many(
            where={"groupId": group_id},
            include={
                "user": True
            }
        ) # type: ignore
        
        # In memory sort since we can't deep sort relations cleanly sometimes
        students.sort(key=lambda s: s.user.lastName if s.user and s.user.lastName else "")
        
        res = []
        for s in students:
            s_dict = s.model_dump()
            if s_dict.get("user"):
                s_dict["user"] = {
                    "id": s_dict["user"]["id"],
                    "firstName": s_dict["user"]["firstName"],
                    "lastName": s_dict["user"]["lastName"],
                    "email": s_dict["user"]["email"],
                    "avatarUrl": s_dict["user"].get("avatarUrl")
                }
            res.append(s_dict)
        return res

    async def get_unassigned_students(self):
        # A student is unassigned if they have no studentProfile or their studentProfile has no groupId
        students = await prisma.user.find_many(
            where={
                "role": Role.STUDENT,
                "isActive": True,
                "OR": [
                    {"studentProfile": {"is": None}}, # type: ignore
                    {"studentProfile": {"is": {"groupId": None}}} # type: ignore
                ]
            }
        ) # type: ignore
        
        return [
            {
                "id": s.id,
                "email": s.email,
                "firstName": s.firstName,
                "lastName": s.lastName
            } for s in students
        ]

    async def assign_student(self, group_id: str, data: StudentAssign, user_id: str, role: Role):
        await require_group_access(group_id, user_id, role)
        async with prisma.tx() as db:
            await db.query_raw('SELECT id FROM "User" WHERE id = $1 FOR UPDATE', data.studentId)
            student = await db.user.find_unique(where={"id": data.studentId})
            if not student or student.role != Role.STUDENT or not student.isActive:
                raise HTTPException(400, "Выберите действующего студента")
            existing = await db.studentprofile.find_unique(where={"userId": data.studentId})
            if existing and existing.groupId not in (None, group_id) and role != Role.ADMIN:
                raise HTTPException(409, "Студент уже состоит в другой группе; перенос доступен администратору")
            profile = await db.studentprofile.upsert(where={"userId": data.studentId}, data={
                "create": {"userId": data.studentId, "groupId": group_id},
                "update": {"groupId": group_id},
            })
            return profile.model_dump()

    async def delete_group(self, group_id: str):
        async with prisma.tx() as db:
            await db.query_raw('SELECT id FROM "Group" WHERE id = $1 FOR UPDATE', group_id)
            if not await db.group.find_unique(where={"id": group_id}):
                raise HTTPException(404, "Группа не найдена")
            if await db.lecture.count(where={"groupId": group_id}) or await db.scheduleitem.count(where={"groupId": group_id}):
                raise HTTPException(409, "У группы есть лекции или расписание. Сначала перенесите или удалите связанные материалы.")
            await db.studentprofile.update_many(where={"groupId": group_id}, data={"groupId": None})
            await db.group.delete(where={"id": group_id})
        return {"success": True}

groups_service = GroupsService()
