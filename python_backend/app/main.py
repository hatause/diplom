import sys
from pathlib import Path

# Добавляем корневую директорию python_backend в sys.path для запуска файла напрямую
_BASE_DIR = Path(__file__).resolve().parent.parent
if str(_BASE_DIR) not in sys.path:
    sys.path.insert(0, str(_BASE_DIR))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from app.db.database import connect_db, disconnect_db, prisma
from app.core.config import settings, UPLOAD_DIR
from app.services.gemini_service import gemini_service
from app.routers import companion, pc_lab
from app.routers import tests, auth, admin, subjects, attempts, analytics, lectures, schedule, groups, teacher, messages, review, upload, achievements, ai, feynman, debate, classroom
from app.services.classroom_search import classroom_search_service
import asyncio

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="AiTutor Backend (Python)", version="1.0.0")

cors_origins = [origin.strip() for origin in settings.CORS_ORIGIN.split(",") if origin.strip()]
for default_origin in [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4000",
    "http://127.0.0.1:4000",
]:
    if default_origin not in cors_origins:
        cors_origins.append(default_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await connect_db()

@app.on_event("shutdown")
async def shutdown_event():
    await gemini_service.close()
    await classroom_search_service.aclose()
    await disconnect_db()

from starlette.exceptions import HTTPException as StarletteHTTPException
from prisma.errors import UniqueViolationError, ForeignKeyViolationError, RecordNotFoundError


@app.exception_handler(StarletteHTTPException)
async def http_error(request, exc):
    return JSONResponse(status_code=exc.status_code, headers=exc.headers,
                        content={"success": False, "error": exc.detail, "detail": exc.detail})


@app.exception_handler(UniqueViolationError)
async def duplicate_record(request, exc):
    return JSONResponse(status_code=409, content={"success": False, "error": "Запись с такими данными уже существует"})


@app.exception_handler(ForeignKeyViolationError)
async def invalid_reference(request, exc):
    return JSONResponse(status_code=409, content={"success": False, "error": "Связанная запись отсутствует или используется другими данными. Обновите страницу."})


@app.exception_handler(RecordNotFoundError)
async def missing_record(request, exc):
    return JSONResponse(status_code=404, content={"success": False, "error": "Запись не найдена или уже удалена"})


# Global exception handler to mimic ApiError format
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.getLogger(__name__).exception("Unhandled server error")
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error"},
    )

app.include_router(tests.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(subjects.router, prefix="/api/v1")
app.include_router(attempts.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(lectures.router, prefix="/api/v1")
app.include_router(schedule.router, prefix="/api/v1")
app.include_router(groups.router, prefix="/api/v1")
app.include_router(teacher.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")
app.include_router(review.router, prefix="/api/v1")
app.include_router(upload.router, prefix="/api/v1")
app.include_router(achievements.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(feynman.router, prefix="/api/v1")
app.include_router(debate.router, prefix="/api/v1")
app.include_router(classroom.router, prefix="/api/v1")
app.include_router(companion.router, prefix="/api/v1")
app.include_router(pc_lab.router, prefix="/api/v1")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.include_router(upload.files_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    try:
        await asyncio.wait_for(prisma.query_raw('SELECT 1 AS ready'), timeout=2)
    except Exception:
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return {"status": "ok"}


if __name__ == "__main__":
    import sys
    from pathlib import Path
    import uvicorn

    # Добавляем корневую директорию python_backend в sys.path
    BASE_DIR = Path(__file__).resolve().parent.parent
    if str(BASE_DIR) not in sys.path:
        sys.path.insert(0, str(BASE_DIR))

    uvicorn.run("app.main:app", host="0.0.0.0", port=4000, reload=True)
