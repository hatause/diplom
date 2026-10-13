import os
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.core.security import require_roles, get_current_user, TokenData
from fastapi.responses import FileResponse
from app.db.database import prisma
from app.services.access import require_lecture_access
from app.services.lecture_material import attachment_path
from app.core.config import UPLOAD_DIR
from prisma.enums import Role
from app.services.lecture_material import MAX_FILE_BYTES

router = APIRouter(prefix="/upload", tags=["Upload"])

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@router.post("", dependencies=[Depends(require_roles([Role.TEACHER, Role.ADMIN]))])
async def upload_file(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    original_name = file.filename or "unknown"
    ext = os.path.splitext(original_name)[1]
    unique_name = f"{uuid.uuid4()}{ext}"
    
    file_path = os.path.join(UPLOAD_DIR, unique_name)
    
    try:
        total = 0
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_FILE_BYTES:
                    raise HTTPException(413, "Допустимы файлы до 12 МБ.")
                buffer.write(chunk)
        if total == 0:
            raise HTTPException(422, "Выбранный файл пуст.")
    except Exception:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise
    finally:
        await file.close()
        
    return {
        "success": True,
        "data": {
            "fileUrl": f"/api/v1/uploads/{unique_name}",
            "fileName": original_name
        }
    }


files_router = APIRouter(prefix="/uploads", tags=["Upload"])


@files_router.get("/{filename}")
async def download_file(filename: str, user: TokenData = Depends(get_current_user)):
    url = f"/api/v1/uploads/{filename}"
    path = attachment_path(url)
    lectures = await prisma.lecture.find_many(where={"fileUrl": url})
    if not lectures and user.role not in (Role.TEACHER, Role.ADMIN):
        raise HTTPException(404, "Файл не найден")
    if lectures:
        for lecture in lectures:
            try:
                await require_lecture_access(lecture, user.userId)
                return FileResponse(path, filename=lecture.fileName or filename)
            except HTTPException as exc:
                if exc.status_code != 403:
                    raise
        raise HTTPException(403, "Нет доступа к этому файлу")
    return FileResponse(path, filename=filename)
