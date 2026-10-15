"""Shared checks for materials and groups visible to the signed-in user."""
from dataclasses import dataclass
from urllib.parse import unquote, urlsplit

from fastapi import HTTPException
from app.db.database import prisma


@dataclass(frozen=True)
class AttachmentReference:
    id: str
    groupId: str | None
    teacherId: str
    fileUrl: str
    fileName: str | None


async def find_attachment_references(canonical_url: str) -> list[AttachmentReference]:
    """Match legacy URL aliases using metadata, without opening other files."""
    candidates = await prisma.query_raw(
        '''SELECT id, "groupId", "teacherId", "fileUrl", "fileName"
           FROM "Lecture"
           WHERE "fileUrl" = $1
              OR strpos("fileUrl", '%') > 0
              OR strpos("fileUrl", '?') > 0
              OR strpos("fileUrl", '#') > 0''',
        canonical_url,
    )
    references = []
    for row in candidates:
        try:
            parsed = urlsplit(row['fileUrl'])
        except ValueError:
            continue
        if not parsed.scheme and not parsed.netloc and unquote(parsed.path) == canonical_url:
            references.append(AttachmentReference(**row))
    return references


async def require_group_access(group_id: str, user_id: str, role: str | None = None):
    if role is None:
        user = await prisma.user.find_unique(where={'id': user_id})
        if not user or not user.isActive:
            raise HTTPException(401, 'Аккаунт недоступен')
        role = user.role
    group = await prisma.group.find_unique(where={'id': group_id}, include={'teachers': True})
    if not group:
        raise HTTPException(404, 'Группа не найдена')
    if role == 'ADMIN' or (role == 'TEACHER' and any(t.id == user_id for t in group.teachers or [])):
        return group
    if role == 'STUDENT':
        profile = await prisma.studentprofile.find_unique(where={'userId': user_id})
        if profile and profile.groupId == group_id:
            return group
    raise HTTPException(403, 'Нет доступа к этой группе')


async def require_lecture_access(lecture, user_id: str):
    if not lecture:
        raise HTTPException(404, 'Лекция не найдена')
    if lecture.groupId:
        # Authorship and old GroupTeachers links survive role changes. They must
        # not let a demoted student bypass their current group membership.
        if lecture.teacherId == user_id:
            user = await prisma.user.find_unique(where={'id': user_id})
            if not user or not user.isActive:
                raise HTTPException(401, 'Аккаунт недоступен')
            if user.role in ('TEACHER', 'ADMIN'):
                return lecture
            await require_group_access(lecture.groupId, user_id, user.role)
        else:
            await require_group_access(lecture.groupId, user_id)
    return lecture
