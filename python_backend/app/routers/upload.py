import os
import shutil
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.core.security import require_roles
from app.core.config import UPLOAD_DIR
from prisma.enums import Role

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
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {
        "success": True,
        "data": {
            "fileUrl": f"/api/v1/uploads/{unique_name}",
            "fileName": original_name
        }
    }
