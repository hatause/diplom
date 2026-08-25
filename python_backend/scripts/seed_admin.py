import asyncio
import sys
import os

# Add parent directory to path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import prisma
from app.services.auth import hash_password
from prisma.enums import Role

async def seed_admin():
    await prisma.connect()
    
    admin_email = "admin@neostudy.com"
    existing = await prisma.user.find_unique(where={"email": admin_email})
    
    password_hash = hash_password("admin123")
    
    if existing:
        print(f"Admin user {admin_email} exists. Updating role and password...")
        await prisma.user.update(
            where={"email": admin_email},
            data={
                "passwordHash": password_hash,
                "role": Role.ADMIN,
                "isActive": True
            }
        )
    else:
        await prisma.user.create(
            data={
                "email": admin_email,
                "passwordHash": password_hash,
                "firstName": "Super",
                "lastName": "Admin",
                "role": Role.ADMIN,
            }
        )
    print(f"Successfully configured admin user: {admin_email} (password: admin123)")
        
    await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(seed_admin())
