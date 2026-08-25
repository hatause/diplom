import asyncio
from app.db.database import connect_db, disconnect_db, prisma
from app.services.auth import hash_password

async def create_new_admin():
    await connect_db()
    
    email = "admin@gmail.com"
    password = "123123123"
    hashed = hash_password(password)
    
    user = await prisma.user.upsert(
        where={"email": email},
        data={
            "create": {
                "email": email,
                "passwordHash": hashed,
                "firstName": "Второй",
                "lastName": "Админ",
                "role": "ADMIN"
            },
            "update": {
                "passwordHash": hashed,
                "role": "ADMIN"
            }
        }
    )
    
    print(f"✅ Admin user created/updated: {user.email}")
    await disconnect_db()

if __name__ == "__main__":
    asyncio.run(create_new_admin())
