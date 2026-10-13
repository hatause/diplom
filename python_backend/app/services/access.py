"""Shared checks for materials and groups visible to the signed-in user."""
from fastapi import HTTPException
from app.db.database import prisma


async def require_group_access(group_id: str, user_id: str, role: str | None = None):
    if role is None:
        user = await prisma.user.find_unique(where={'id': user_id})
        if not user or not user.isActive:
            raise HTTPException(401, 'Аккаунт недоступен')
        role = user.role
    group = await prisma.group.find_unique(where={'id': group_id}, include={'teachers': True})
    if not group:
        raise HTTPException(404, 'Группа не найдена')
    if role == 'ADMIN' or any(t.id == user_id for t in group.teachers or []):
        return group
    if role == 'STUDENT':
        profile = await prisma.studentprofile.find_unique(where={'userId': user_id})
        if profile and profile.groupId == group_id:
            return group
    raise HTTPException(403, 'Нет доступа к этой группе')


async def require_lecture_access(lecture, user_id: str):
    if not lecture:
        raise HTTPException(404, 'Лекция не найдена')
    if lecture.groupId and lecture.teacherId != user_id:
        await require_group_access(lecture.groupId, user_id)
    return lecture
