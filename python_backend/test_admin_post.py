import asyncio
import httpx

async def run():
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
        res = await client.post("/api/v1/auth/login", json={"email":"admin@neostudy.com","password":"admin123"})
        token = res.json()["data"]["accessToken"]
        
        res = await client.get("/api/v1/admin/subjects", headers={"Authorization": f"Bearer {token}"})
        print("GET subjects:", res.status_code, res.text)
        
        res = await client.post("/api/v1/admin/subjects", headers={"Authorization": f"Bearer {token}"}, json={
            "name": "Test Subject",
            "code": "TS-101",
            "description": "test",
            "color": "blue"
        })
        print("POST subjects:", res.status_code, res.text)

asyncio.run(run())
