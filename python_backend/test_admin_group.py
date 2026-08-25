import asyncio
import httpx

async def run():
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
        res = await client.post("/api/v1/auth/login", json={"email":"admin@neostudy.com","password":"admin123"})
        token = res.json()["data"]["accessToken"]
        
        res = await client.post("/api/v1/admin/groups", headers={"Authorization": f"Bearer {token}"}, json={
            "name": "Test Group 1"
        })
        print("POST groups:", res.status_code, res.text)

asyncio.run(run())
