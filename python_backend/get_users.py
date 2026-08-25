import asyncio
from app.db.database import connect_db, disconnect_db, prisma

async def get_users():
    await connect_db()
    users = await prisma.user.find_many()
    for u in users:
        print(f"Role: {u.role}, Email: {u.email}, Name: {u.firstName} {u.lastName}")
    await disconnect_db()

if __name__ == "__main__":
    asyncio.run(get_users())
