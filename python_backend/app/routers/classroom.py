import logging

from fastapi import APIRouter, Body, Depends, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from app.core.security import get_current_user, TokenData
from app.schemas.classroom import ClassroomSearchRequest
from app.services.classroom_search import classroom_search_service, ClassroomSearchError

logger = logging.getLogger(__name__)


class ClassroomRoute(APIRoute):
    """Returns validation errors as ``{"success": false, "reason": "invalid_request"}`` for this router only."""

    def get_route_handler(self):
        original_handler = super().get_route_handler()

        async def handler(request: Request):
            try:
                return await original_handler(request)
            except RequestValidationError as exc:
                return JSONResponse(
                    status_code=400,
                    content={"success": False, "reason": "invalid_request", "error": _validation_message(exc)},
                )

        return handler


def _validation_message(exc: RequestValidationError) -> str:
    for error in exc.errors():
        if error.get("type") == "value_error":
            return str(error.get("msg", "")).removeprefix("Value error, ")
    return "Укажите корпус (locationId) и длительность в минутах (durationMinutes)"


router = APIRouter(prefix="/classroom", tags=["Classroom Search"], route_class=ClassroomRoute)


@router.get("/locations")
async def get_locations(current_user: TokenData = Depends(get_current_user)):
    return {"success": True, "data": classroom_search_service.get_locations()}


@router.post("/search")
async def search_classroom(
    payload: ClassroomSearchRequest = Body(...),
    current_user: TokenData = Depends(get_current_user),
):
    try:
        result = await classroom_search_service.search(payload.locationId, payload.durationMinutes, current_user.userId)
    except ClassroomSearchError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "reason": exc.reason, "error": exc.message},
        )
    except Exception:
        logger.exception("Unexpected classroom search failure")
        return JSONResponse(
            status_code=500,
            content={"success": False, "reason": "internal_error", "error": "Внутренняя ошибка сервера"},
        )

    if not result.found:
        return {"success": False, "reason": "not_found", "message": result.message}
    return {"success": True, "classroom": result.classroom, "additionalData": result.additional_data}
