"""Free classroom search through the Java bridge server (team-ENERGO schedule-server).

Website -> this backend -> Java ``POST /api/bridge`` -> C++ engine (TCP) -> Java -> this backend.
The search algorithm (nearest class start + C++ lookup) lives in the Java/C++ services;
this module only adapts the request/response and turns failures into safe error codes.

The Java server answers 200 even when the C++ engine fails, putting the error into
``reason``, so engine failures are recognised by that text.
"""

import asyncio
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Optional

import httpx

from app.core.config import settings
from app.schemas.classroom import LOCATIONS

logger = logging.getLogger(__name__)

MAX_UPSTREAM_RESPONSE_BYTES = 256 * 1024
QUEUE_WAIT_SECONDS = 2.0
CONNECT_TIMEOUT_SECONDS = 3.0

JAVA_ENGINE_ERROR_PREFIX = "Ошибка при запросе к C++ серверу"
JAVA_NO_MORE_CLASSES_PREFIX = "На сегодня пар больше нет"
_JAVA_NOT_FOUND_TIME = re.compile(r"не нашёл свободный кабинет на (\d{1,2}:\d{2})")
_TIMEOUT_MARKERS = ("таймаут", "timed out", "timeout")


class ClassroomSearchError(Exception):
    """``reason``/``message`` are safe to show to users; ``detail`` goes to logs only."""

    def __init__(self, reason: str, status_code: int, message: str, detail: str = ""):
        super().__init__(detail or reason)
        self.reason = reason
        self.status_code = status_code
        self.message = message
        self.detail = detail

    @classmethod
    def service_unavailable(cls, detail: str = ""):
        return cls("service_unavailable", 503, "Сервер поиска кабинетов временно недоступен", detail)

    @classmethod
    def engine_unavailable(cls, detail: str = ""):
        return cls("search_engine_unavailable", 503, "Модуль поиска свободных кабинетов временно недоступен", detail)

    @classmethod
    def timeout(cls, detail: str = ""):
        return cls("timeout", 504, "Сервис поиска не ответил вовремя, попробуйте ещё раз", detail)

    @classmethod
    def bad_upstream(cls, detail: str = ""):
        return cls("bad_upstream_response", 502, "Сервис поиска вернул некорректный ответ", detail)

    @classmethod
    def busy(cls):
        return cls("busy", 503, "Слишком много запросов, попробуйте через несколько секунд")

    @classmethod
    def not_configured(cls):
        return cls("service_unavailable", 503, "Поиск кабинетов не настроен на сервере", "ROOM_FINDER_JAVA_URL is empty")


@dataclass
class ClassroomSearchResult:
    found: bool
    classroom: Optional[str] = None
    additional_data: dict = field(default_factory=dict)
    message: Optional[str] = None


def _room_label(room: dict) -> str:
    name = str(room.get("name") or "").strip()
    corpus = str(room.get("location_name") or "").strip()
    if corpus and name and not name.startswith(corpus):
        return f"{corpus}-{name}"
    return name


def _room_details(room: dict) -> dict:
    return {
        "name": _room_label(room),
        "number": room.get("name"),
        "corpus": room.get("location_name"),
        "locationId": room.get("location_id"),
        "floor": room.get("floor"),
        "capacity": room.get("capacity"),
        "availableFrom": room.get("available_from"),
        "availableUntil": room.get("available_until"),
        "scheduleFree": room.get("schedule_free"),
        "cameraFree": room.get("camera_free"),
        "cameraStatus": room.get("camera_status"),
    }


def parse_bridge_response(payload: Any) -> ClassroomSearchResult:
    """Maps the Java FindRoomResponse ``{free_rooms, alternatives, reason}``."""
    if not isinstance(payload, dict):
        raise ClassroomSearchError.bad_upstream("payload is not an object")
    free_rooms = payload.get("free_rooms")
    alternatives = payload.get("alternatives") or []
    reason = payload.get("reason") or ""
    if not isinstance(free_rooms, list) or not isinstance(alternatives, list) or not isinstance(reason, str):
        raise ClassroomSearchError.bad_upstream("unexpected FindRoomResponse shape")

    rooms = [r for r in free_rooms if isinstance(r, dict) and str(r.get("name") or "").strip()]
    if rooms:
        best = _room_details(rooms[0])
        return ClassroomSearchResult(
            found=True,
            classroom=best["name"],
            additional_data={
                **best,
                "otherRooms": [_room_details(r) for r in rooms[1:]],
                "alternatives": [_room_details(r) for r in alternatives if isinstance(r, dict)],
            },
        )

    if reason.startswith(JAVA_ENGINE_ERROR_PREFIX):
        if any(marker in reason.lower() for marker in _TIMEOUT_MARKERS):
            raise ClassroomSearchError.timeout(f"java reason: {reason}")
        raise ClassroomSearchError.engine_unavailable(f"java reason: {reason}")

    # Only Java's own user-facing texts are passed through; anything else gets a generic message
    if reason.startswith(JAVA_NO_MORE_CLASSES_PREFIX):
        message = reason
    elif match := _JAVA_NOT_FOUND_TIME.search(reason):
        message = f"Свободных кабинетов на {match.group(1)} не найдено"
    else:
        message = "Свободный кабинет не найден"
    return ClassroomSearchResult(found=False, message=message)


class JavaRoomFinderClient:
    def __init__(self, base_url: str, api_key: str, timeout: float, max_connections: int):
        self._url = base_url.rstrip("/") + "/api/bridge" if base_url else ""
        self._api_key = api_key
        self._timeout = httpx.Timeout(timeout, connect=min(timeout, CONNECT_TIMEOUT_SECONDS))
        self._limits = httpx.Limits(max_connections=max_connections, max_keepalive_connections=max_connections)
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self._timeout, limits=self._limits)
        return self._client

    async def find_rooms(self, location_id: str, duration_minutes: int, user_id: str) -> ClassroomSearchResult:
        if not self._url:
            raise ClassroomSearchError.not_configured()

        headers = {"Accept": "application/json"}
        if self._api_key:
            headers["X-API-Key"] = self._api_key
        body = {
            "location_id": location_id,
            "duration_minutes": duration_minutes,
            "requested_by": {"telegram_user_id": 0, "user_id": user_id},
        }
        try:
            response = await self._get_client().post(self._url, json=body, headers=headers)
        except httpx.ConnectTimeout as exc:
            raise ClassroomSearchError.service_unavailable(f"connect timeout: {exc!r}")
        except httpx.TimeoutException as exc:
            raise ClassroomSearchError.timeout(f"read timeout: {exc!r}")
        except httpx.TransportError as exc:
            raise ClassroomSearchError.service_unavailable(f"transport error: {exc!r}")

        if len(response.content) > MAX_UPSTREAM_RESPONSE_BYTES:
            raise ClassroomSearchError.bad_upstream("response too large")
        if response.status_code >= 500:
            raise ClassroomSearchError.service_unavailable(f"HTTP {response.status_code}: {response.text[:300]}")
        if response.status_code != 200:
            raise ClassroomSearchError.bad_upstream(f"HTTP {response.status_code}: {response.text[:300]}")
        try:
            payload = response.json()
        except ValueError:
            raise ClassroomSearchError.bad_upstream("invalid JSON")
        return parse_bridge_response(payload)

    async def aclose(self):
        if self._client is not None:
            await self._client.aclose()
            self._client = None


class ClassroomSearchService:
    def __init__(self):
        self._client: JavaRoomFinderClient | None = None
        self._semaphore: asyncio.Semaphore | None = None

    @property
    def client(self) -> JavaRoomFinderClient:
        if self._client is None:
            self._client = JavaRoomFinderClient(
                settings.ROOM_FINDER_JAVA_URL,
                settings.ROOM_FINDER_API_KEY,
                settings.ROOM_FINDER_TIMEOUT_SECONDS,
                settings.ROOM_FINDER_MAX_CONCURRENCY,
            )
        return self._client

    def get_locations(self) -> list[dict]:
        return [{"id": loc["id"], "name": loc["name"]} for loc in LOCATIONS]

    async def search(self, location_id: str, duration_minutes: int, user_id: str) -> ClassroomSearchResult:
        # Java sends requests to C++ one at a time, so we cap how many we keep in flight
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(max(1, settings.ROOM_FINDER_MAX_CONCURRENCY))
        try:
            await asyncio.wait_for(self._semaphore.acquire(), timeout=QUEUE_WAIT_SECONDS)
        except asyncio.TimeoutError:
            raise ClassroomSearchError.busy()

        try:
            try:
                return await asyncio.wait_for(
                    self.client.find_rooms(location_id, duration_minutes, user_id),
                    timeout=settings.ROOM_FINDER_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                raise ClassroomSearchError.timeout("no answer from Java bridge in time")
        except ClassroomSearchError as exc:
            logger.warning("Classroom search failed: %s (%s)", exc.reason, exc.detail)
            raise
        finally:
            self._semaphore.release()

    async def aclose(self):
        if self._client is not None:
            await self._client.aclose()


classroom_search_service = ClassroomSearchService()
