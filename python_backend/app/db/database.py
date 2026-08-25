from prisma import Prisma
import asyncio

prisma = Prisma()

async def connect_db():
    await prisma.connect()

async def disconnect_db():
    await prisma.disconnect()
