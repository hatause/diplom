"""Feynman Learning Mode service.

Sessions are stored as AIInteraction records with type='FEYNMAN_SESSION'.
Conversation history and session state are stored in the JSON `response` field.
"""

import json
import logging
import uuid
from typing import Dict, Any, List, Optional

from fastapi import HTTPException
from app.db.database import prisma
from app.services.gemini_service import gemini_service
from app.services.prompts import FEYNMAN_SYSTEM_PROMPT, FEYNMAN_ASSESSMENT_PROMPT

logger = logging.getLogger(__name__)


class FeynmanService:
    async def create_session(self, user_id: str, topic: str, subject_id: Optional[str] = None) -> Dict[str, Any]:
        """Create a new Feynman learning session."""

        # Build initial AI message
        subject_context = ""
        if subject_id:
            subject = await prisma.subject.find_unique(where={"id": subject_id})
            if subject:
                subject_context = f" (предмет: {subject.name})"

        initial_prompt = f"The topic to learn about is: {topic}{subject_context}. Start by telling the user you don't understand anything about this topic and ask them to explain it from scratch."

        # Get the initial AI question
        initial_messages = [{"role": "user", "content": initial_prompt}]
        ai_response = await gemini_service.chat(FEYNMAN_SYSTEM_PROMPT, initial_messages)

        session_id = str(uuid.uuid4())
        conversation_history = [
            {"role": "assistant", "content": ai_response},
        ]

        session_data = {
            "id": session_id,
            "topic": topic,
            "subjectId": subject_id,
            "status": "active",
            "difficulty": 1,
            "messageCount": 1,
            "conversationHistory": conversation_history,
            "assessment": None,
        }

        # Store in DB as AIInteraction
        await prisma.aiinteraction.create(
            data={
                "id": session_id,
                "userId": user_id,
                "type": "FEYNMAN_SESSION",
                "prompt": topic,
                "response": json.dumps(session_data, ensure_ascii=False),
                "model": gemini_service.model,
                "subjectName": subject_id,
            }
        )  # type: ignore

        return session_data

    async def get_session(self, user_id: str, session_id: str) -> Dict[str, Any]:
        """Retrieve a Feynman session by ID."""

        record = await self._find_record(user_id, session_id)
        try:
            return json.loads(record.response)
        except (ValueError, TypeError):
            raise HTTPException(422, "Данные сессии повреждены")

    async def _find_record(self, user_id, session_id):
        record = await prisma.aiinteraction.find_first(where={
            "userId": user_id, "type": "FEYNMAN_SESSION",
            "OR": [{"id": session_id}, {"response": {"contains": f'"id": "{session_id}"'}}],
        })
        if not record:
            raise HTTPException(404, "Session not found")
        return record

    async def send_explanation(self, user_id: str, session_id: str, explanation: str) -> Dict[str, Any]:
        """User sends an explanation, AI responds with a follow-up question."""

        session = await self.get_session(user_id, session_id)
        expected = json.dumps(session, ensure_ascii=False)
        if session["status"] != "active":
            raise HTTPException(status_code=400, detail="Session is already completed")

        history = session["conversationHistory"]
        history.append({"role": "user", "content": explanation})

        # Build context for difficulty progression
        difficulty = session.get("difficulty", 1)
        msg_count = session.get("messageCount", 0)

        # Increase difficulty every 4 exchanges
        if msg_count > 1 and (msg_count - 1) % 8 == 0 and difficulty < 5:
            difficulty += 1

        difficulty_instruction = ""
        if difficulty >= 3:
            difficulty_instruction = "\n[INSTRUCTION: The student has answered several questions. Increase the difficulty — ask about edge cases, exceptions, or deeper cause-and-effect relationships.]"
        if difficulty >= 5:
            difficulty_instruction = "\n[INSTRUCTION: Advanced level — ask about practical applications, limitations, or connections to related topics.]"

        # Prepare messages for Gemini
        messages = [{"role": m["role"], "content": m["content"]} for m in history]
        if difficulty_instruction:
            messages.append({"role": "user", "content": difficulty_instruction})

        ai_response = await gemini_service.chat(FEYNMAN_SYSTEM_PROMPT, messages)

        history.append({"role": "assistant", "content": ai_response})

        session["conversationHistory"] = history
        session["messageCount"] = msg_count + 2
        session["difficulty"] = difficulty

        # Update in DB
        await self._update_session(user_id, session_id, session, expected)

        return session

    async def complete_session(self, user_id: str, session_id: str) -> Dict[str, Any]:
        """Complete a Feynman session and generate assessment."""

        session = await self.get_session(user_id, session_id)
        expected = json.dumps(session, ensure_ascii=False)
        if session["status"] == "completed" and session.get("assessment"):
            return session

        history = session["conversationHistory"]

        # Build assessment prompt
        conversation_text = "\n".join(
            f"{'AI (student)' if m['role'] == 'assistant' else 'User (teacher)'}: {m['content']}"
            for m in history
        )

        assessment_prompt = f"""Topic: {session['topic']}

Full conversation:
{conversation_text}

Evaluate the user's understanding based on their explanations."""

        assessment = await gemini_service.generate_json(
            FEYNMAN_ASSESSMENT_PROMPT, assessment_prompt, max_output_tokens=4096
        )

        session["status"] = "completed"
        session["assessment"] = assessment

        await self._update_session(user_id, session_id, session, expected)

        return session

    async def _update_session(self, user_id, session_id, session_data, expected):
        record = await self._find_record(user_id, session_id)
        count = await prisma.aiinteraction.update_many(
            where={"id": record.id, "response": expected},
            data={"response": json.dumps(session_data, ensure_ascii=False)},
        )
        if not count:
            raise HTTPException(409, "Сессия изменена в другой вкладке. Обновите страницу.")


feynman_service = FeynmanService()
