from app.db.database import prisma
from datetime import datetime, timezone

class ScheduleService:
    def __init__(self):
        self.sync_status = 'connected'
        self.last_sync_at = datetime.now(timezone.utc)
        self.provider_mode = 'database'

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
        today = datetime.now(timezone.utc).weekday() + 1 # 1=Mon, 7=Sun in python but let's assume JS 0=Sun
        # JS getDay(): 0 is Sunday, 1 is Monday.
        # Python weekday(): 0 is Monday, 6 is Sunday.
        # Let's map python to JS
        js_today = (datetime.now(timezone.utc).weekday() + 1) % 7
        
        where_clause = {"isActive": True, "dayOfWeek": js_today}
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
