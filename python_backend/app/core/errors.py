from fastapi import HTTPException
from typing import Any, Optional

class ApiError(HTTPException):
    def __init__(self, status_code: int, detail: str, extra: Optional[Any] = None):
        super().__init__(status_code=status_code, detail=detail)
        self.extra = extra

    @classmethod
    def service_unavailable(cls, message: str = "Service unavailable"):
        return cls(status_code=503, detail=message)
