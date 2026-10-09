from app.db.database import prisma
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from app.core.config import settings
from app.schemas.schedule import ScheduleItemWrite
from fastapi import HTTPException
from prisma import Json
from prisma.errors import ForeignKeyViolationError, RecordNotFoundError

class ScheduleService:
    def __init__(self):
        self.sync_status = 'connected'
        self.last_sync_at = datetime.now(timezone.utc)
        self.provider_mode = 'database'

    async def get_admin_schedule(self):
        # Include hidden entries so administrators can restore or delete them.
        items = await prisma.scheduleitem.find_many(
            include={"subject": True, "group": True},
            order=[{"dayOfWeek": "asc"}, {"startTime": "asc"}, {"id": "asc"}],
        )
        return {"items": [self._format_item(item) for item in items], "total": len(items)}

    async def _validated_data(self, db, payload: ScheduleItemWrite):
        subject = await db.subject.find_unique(where={"id": payload.subjectId}, include={"teacher": True})
        if not subject:
            raise HTTPException(400, "Выбранный предмет не найден")
        if not await db.group.find_unique(where={"id": payload.groupId}):
            raise HTTPException(400, "Выбранная группа не найдена")
        data = payload.model_dump()
        if "teacherName" not in payload.model_fields_set and subject.teacher:
            data["teacherName"] = f"{subject.teacher.firstName} {subject.teacher.lastName}"
        return data

    async def _audit(self, db, admin_id, action, item_id=None, details=None):
        await db.auditlog.create(data={
            "userId": admin_id, "action": action, "entity": "ScheduleItem",
            "entityId": item_id, "details": Json(details or {}),
        })

    async def create_item(self, admin_id: str, payload: ScheduleItemWrite):
        try:
            async with prisma.tx() as db:
                data = await self._validated_data(db, payload)
                item = await db.scheduleitem.create(data=data, include={"subject": True, "group": True})
                await self._audit(db, admin_id, "SCHEDULE_CREATE", item.id, data)
        except ForeignKeyViolationError:
            raise HTTPException(400, "Группа или предмет были удалены. Обновите список")
        self.last_sync_at = datetime.now(timezone.utc)
        return self._format_item(item)

    async def update_item(self, admin_id: str, item_id: str, payload: ScheduleItemWrite):
        try:
            async with prisma.tx() as db:
                if not await db.scheduleitem.find_unique(where={"id": item_id}):
                    raise HTTPException(404, "Занятие не найдено или уже удалено")
                data = await self._validated_data(db, payload)
                item = await db.scheduleitem.update(
                    where={"id": item_id}, data=data, include={"subject": True, "group": True},
                )
                await self._audit(db, admin_id, "SCHEDULE_UPDATE", item_id, data)
        except RecordNotFoundError:
            raise HTTPException(404, "Занятие не найдено или уже удалено")
        except ForeignKeyViolationError:
            raise HTTPException(400, "Группа или предмет были удалены. Обновите список")
        self.last_sync_at = datetime.now(timezone.utc)
        return self._format_item(item)

    async def delete_item(self, admin_id: str, item_id: str):
        async with prisma.tx() as db:
            count = await db.scheduleitem.delete_many(where={"id": item_id})
            if not count:
                raise HTTPException(404, "Занятие не найдено или уже удалено")
            await self._audit(db, admin_id, "SCHEDULE_DELETE", item_id)
        self.last_sync_at = datetime.now(timezone.utc)
        return {"deletedCount": count}

    async def clear_items(self, admin_id: str):
        async with prisma.tx() as db:
            count = await db.scheduleitem.delete_many()
            await self._audit(db, admin_id, "SCHEDULE_CLEAR", details={"deletedCount": count})
        self.last_sync_at = datetime.now(timezone.utc)
        return {"deletedCount": count}

    async def get_schedule(self, group_code: str = None):
        where_clause = {"isActive": True}
        if group_code:
            where_clause["group"] = {"is": {"code": group_code}} # type: ignore

        items = await prisma.scheduleitem.find_many(
            where=where_clause, # type: ignore
            include={
                "subject": True,
                "group": True
            },
            order=[{"dayOfWeek": "asc"}, {"startTime": "asc"}] # type: ignore
        )

        return {
            "items": [self._format_item(i) for i in items],
            "status": self.sync_status,
            "lastSyncAt": self.last_sync_at.isoformat(),
            "providerMode": self.provider_mode
        }

    async def get_today(self, group_code: str = None):
        now = datetime.now(ZoneInfo(settings.SCHOOL_TIMEZONE))
        js_today = (now.weekday() + 1) % 7
        week_type = "odd" if now.isocalendar().week % 2 else "even"
        where_clause = {"isActive": True, "dayOfWeek": js_today,
                        "OR": [{"weekType": None}, {"weekType": week_type}]}
        if group_code:
            where_clause["group"] = {"is": {"code": group_code}} # type: ignore

        items = await prisma.scheduleitem.find_many(
            where=where_clause, # type: ignore
            include={
                "subject": True,
                "group": True
            },
            order={"startTime": "asc"}
        )

        return {
            "items": [self._format_item(i) for i in items],
            "dayOfWeek": js_today,
            "status": self.sync_status
        }

    async def get_week(self, group_code: str = None):
        where_clause = {"isActive": True}
        if group_code:
            where_clause["group"] = {"is": {"code": group_code}} # type: ignore

        items = await prisma.scheduleitem.find_many(
            where=where_clause, # type: ignore
            include={
                "subject": True,
                "group": True
            },
            order=[{"dayOfWeek": "asc"}, {"startTime": "asc"}] # type: ignore
        )

        week = {i: [] for i in range(7)}
        for item in items:
            week[item.dayOfWeek].append(self._format_item(item))

        return {
            "week": week,
            "status": self.sync_status
        }

    def get_status(self):
        return {
            "status": self.sync_status,
            "lastSyncAt": self.last_sync_at.isoformat(),
            "provider": self.provider_mode
        }

    def _format_item(self, item):
        d = item.model_dump()
        if d.get("subject"):
            d["subject"] = {
                "id": d["subject"]["id"],
                "name": d["subject"]["name"],
                "code": d["subject"]["code"],
                "color": d["subject"]["color"],
                "iconName": d["subject"].get("iconName")
            }
        if d.get("group"):
            d["group"] = {
                "id": d["group"]["id"],
                "name": d["group"]["name"],
                "code": d["group"]["code"]
            }
        return d

schedule_service = ScheduleService()
