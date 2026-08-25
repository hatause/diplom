import asyncio
import httpx
from app.services.auth import auth_service
from app.schemas.auth import LoginRequest
import logging

logging.basicConfig(level=logging.INFO)

async def run():
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
        res = await client.post("/api/v1/auth/login", json={"email":"admin@neostudy.com","password":"admin123"})
        token = res.json()["data"]["accessToken"]
        
        print("Fetching subjects...")
        res = await client.get("/api/v1/admin/subjects", headers={"Authorization": f"Bearer {token}"})
        print("GET subjects status:", res.status_code)
        print(res.text)

        print("Fetching groups...")
        res = await client.get("/api/v1/admin/groups", headers={"Authorization": f"Bearer {token}"})
        print("GET groups status:", res.status_code)
        print(res.text)

asyncio.run(run())
