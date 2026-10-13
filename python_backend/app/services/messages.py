from app.db.database import prisma
from fastapi import HTTPException
from prisma.enums import Role
from app.schemas.messages import SendMessageRequest

class MessagesService:
    async def get_contacts(self, user_id: str, role: Role):
        contacts_dict = {}

        if role == Role.TEACHER:
            groups = await prisma.group.find_many(
                where={"teachers": {"some": {"id": user_id}}},
                include={
                    "students": {
                        "include": {"user": True}
                    }
                }
            )
            for g in groups:
                if g.students:
                    for s in g.students:
                        if s.user:
                            contacts_dict[s.userId] = s.user
        elif role == Role.STUDENT:
            profile = await prisma.studentprofile.find_unique(
                where={"userId": user_id},
                include={
                    "group": {
                        "include": {"teachers": True}
                    }
                }
            )
            if profile and profile.group and profile.group.teachers:
                for t in profile.group.teachers:
                    contacts_dict[t.id] = t
        elif role == Role.ADMIN:
            all_users = await prisma.user.find_many(
                where={"id": {"not": user_id}}
            )
            for u in all_users:
                contacts_dict[u.id] = u

        existing_msgs = await prisma.message.find_many(
            where={"OR": [{"senderId": user_id}, {"receiverId": user_id}]}
        )

        ids_to_fetch = set()
        for m in existing_msgs:
            if m.senderId != user_id and m.senderId not in contacts_dict:
                ids_to_fetch.add(m.senderId)
            if m.receiverId != user_id and m.receiverId not in contacts_dict:
                ids_to_fetch.add(m.receiverId)

        if ids_to_fetch:
            extra_users = await prisma.user.find_many(
                where={"id": {"in": list(ids_to_fetch)}}
            )
            for u in extra_users:
                contacts_dict[u.id] = u

        return [
            {
                "id": u.id,
                "firstName": u.firstName,
                "lastName": u.lastName,
                "avatarUrl": u.avatarUrl
            }
            for u in contacts_dict.values()
        ]

    async def get_messages(self, my_id: str, other_id: str):
        messages = await prisma.message.find_many(
            where={
                "OR": [
                    {"senderId": my_id, "receiverId": other_id},
                    {"senderId": other_id, "receiverId": my_id},
                ]
            },
            order={"createdAt": "asc"}
        )

        await prisma.message.update_many(
            where={"senderId": other_id, "receiverId": my_id, "isRead": False},
            data={"isRead": True}
        )

        return [
            {**m.model_dump(), "isRead": True if m.receiverId == my_id else m.isRead}
            for m in messages
        ]

    async def send_message(self, sender_id: str, data: SendMessageRequest):
        if sender_id == data.receiverId:
            raise HTTPException(400, "Нельзя отправить сообщение самому себе")
        receiver = await prisma.user.find_unique(where={"id": data.receiverId})
        if not receiver or not receiver.isActive:
            raise HTTPException(404, "Получатель не найден или отключён")
        msg = await prisma.message.create(
            data={
                "senderId": sender_id,
                "receiverId": data.receiverId,
                "content": data.content
            }
        )
        return msg.model_dump()

    async def search_users(self, current_user_id: str, query: str):
        if not query or len(query) < 2:
            return []
            
        users = await prisma.user.find_many(
            where={
                "AND": [
                    {"id": {"not": current_user_id}},
                    {"isActive": True},
                    {"OR": [
                        {"firstName": {"contains": query, "mode": "insensitive"}},
                        {"lastName": {"contains": query, "mode": "insensitive"}},
                        {"email": {"contains": query, "mode": "insensitive"}}
                    ]}
                ]
            },
            take=20
        )
        
        return [
            {
                "id": u.id,
                "firstName": u.firstName,
                "lastName": u.lastName,
                "avatarUrl": u.avatarUrl,
                "role": u.role
            }
            for u in users
        ]

messages_service = MessagesService()
