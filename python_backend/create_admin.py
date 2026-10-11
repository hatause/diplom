import asyncio
from app.db.database import connect_db, disconnect_db, prisma
from app.services.auth import hash_password
from prisma.enums import Role

async def make_admin(email: str, password: str, first_name: str, last_name: str):
    hashed = hash_password(password)
    user = await prisma.user.upsert(
        where={"email": email.strip().lower()},
        data={
            "create": {
                "email": email.strip().lower(),
                "passwordHash": hashed,
                "firstName": first_name,
                "lastName": last_name,
                "role": Role.ADMIN,
                "isActive": True
            },
            "update": {
                "passwordHash": hashed,
                "role": Role.ADMIN,
                "isActive": True
            }
        }
    )
    print(f"✅ Admin ready: {user.email} (Password: {password})")

async def main():
    await connect_db()
    await make_admin("admin@admin.com", "admin123", "Главный", "Администратор")
    await make_admin("admin@aitutor.com", "admin123", "Системный", "Администратор")
    await disconnect_db()

if __name__ == "__main__":
    asyncio.run(main())
