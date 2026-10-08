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

from app.db.database import connect_db, disconnect_db
from app.core.config import settings
from app.services.gemini_service import gemini_service
from app.routers import companion
from app.routers import tests, auth, admin, subjects, attempts, analytics, lectures, schedule, groups, teacher, messages, review, upload, achievements, ai, feynman, debate, classroom
from app.services.classroom_search import classroom_search_service
from fastapi.staticfiles import StaticFiles

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="AiTutor Backend (Python)", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGIN.split(",") if origin.strip()],
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

import os
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
app.mount("/api/v1/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/health")
def health_check():
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

