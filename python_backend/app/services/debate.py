"""Debate Mode service.

Sessions are stored as AIInteraction records with type='DEBATE_SESSION'.
Conversation history and session state are stored in the JSON `response` field.
"""

import json
import logging
import uuid
from typing import Dict, Any, Optional

from fastapi import HTTPException
from app.db.database import prisma
from app.services.gemini_service import gemini_service
from app.services.prompts import DEBATE_SYSTEM_PROMPT, DEBATE_ASSESSMENT_PROMPT

logger = logging.getLogger(__name__)


class DebateService:
    async def create_session(
        self, user_id: str, topic: str, user_position: str, subject_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new debate session. AI takes the opposing position."""

        subject_context = ""
        if subject_id:
            subject = await prisma.subject.find_unique(where={"id": subject_id})
            if subject:
                subject_context = f" (subject: {subject.name})"

        # AI takes opposing position
        ai_position = f"opposing \"{user_position}\""

        initial_prompt = (
            f"The debate topic is: \"{topic}\"{subject_context}.\n"
            f"The user's position is: \"{user_position}\".\n"
            f"You are arguing AGAINST this position.\n\n"
            f"Start the debate by presenting your opening counter-argument to the user's position. "
            f"Be respectful but firm. End with a question that challenges the user's stance."
        )

        initial_messages = [{"role": "user", "content": initial_prompt}]
        ai_response = await gemini_service.chat(DEBATE_SYSTEM_PROMPT, initial_messages)

        session_id = str(uuid.uuid4())
        conversation_history = [
            {"role": "assistant", "content": ai_response},
        ]

        session_data = {
            "id": session_id,
            "topic": topic,
            "userPosition": user_position,
            "aiPosition": ai_position,
            "subjectId": subject_id,
            "status": "active",
            "roundNumber": 1,
            "conversationHistory": conversation_history,
            "assessment": None,
        }

        await prisma.aiinteraction.create(
            data={
                "id": session_id,
                "userId": user_id,
                "type": "DEBATE_SESSION",
                "prompt": f"{topic} | Position: {user_position}",
                "response": json.dumps(session_data, ensure_ascii=False),
                "model": gemini_service.model,
                "subjectName": subject_id,
            }
        )  # type: ignore

        return session_data

    async def get_session(self, user_id: str, session_id: str) -> Dict[str, Any]:
        """Retrieve a debate session by ID."""

        record = await self._find_record(user_id, session_id)
        try:
            return json.loads(record.response)
        except (ValueError, TypeError):
            raise HTTPException(422, "Данные сессии повреждены")

    async def _find_record(self, user_id, session_id):
        record = await prisma.aiinteraction.find_first(where={
            "userId": user_id, "type": "DEBATE_SESSION",
            "OR": [{"id": session_id}, {"response": {"contains": f'"id": "{session_id}"'}}],
        })
        if not record:
            raise HTTPException(404, "Session not found")
        return record

    async def send_argument(self, user_id: str, session_id: str, argument: str) -> Dict[str, Any]:
        """User sends an argument, AI responds with counterargument."""

        session = await self.get_session(user_id, session_id)
        expected = json.dumps(session, ensure_ascii=False)
        if session["status"] != "active":
            raise HTTPException(status_code=400, detail="Debate session is already completed")

        history = session["conversationHistory"]
        history.append({"role": "user", "content": argument})

        round_number = session.get("roundNumber", 1)

        # Add context for later rounds
        round_instruction = ""
        if round_number >= 5:
            round_instruction = "\n[INSTRUCTION: This is a later round. Focus on finding the strongest remaining counterargument. If the user has made genuinely strong points, acknowledge them while pressing on weak areas.]"
        if round_number >= 8:
            round_instruction = "\n[INSTRUCTION: Final rounds. Start wrapping up — summarize the key points of disagreement and acknowledge the strongest arguments from both sides.]"

        messages = [{"role": m["role"], "content": m["content"]} for m in history]
        if round_instruction:
            messages[-1]["content"] += round_instruction

        # Add debate context
        context_msg = f"[Debate topic: {session['topic']}. User's position: {session['userPosition']}. You argue against it. Round {round_number}.]"
        messages[0] = {"role": messages[0]["role"], "content": context_msg + "\n" + messages[0]["content"]}

        ai_response = await gemini_service.chat(DEBATE_SYSTEM_PROMPT, messages)

        history.append({"role": "assistant", "content": ai_response})

        session["conversationHistory"] = history
        session["roundNumber"] = round_number + 1

        await self._update_session(user_id, session_id, session, expected)

        return session

    async def complete_session(self, user_id: str, session_id: str) -> Dict[str, Any]:
        """Complete a debate session and generate assessment."""

        session = await self.get_session(user_id, session_id)
        expected = json.dumps(session, ensure_ascii=False)
        if session["status"] == "completed" and session.get("assessment"):
            return session

        history = session["conversationHistory"]

        conversation_text = "\n".join(
            f"{'AI (opponent)' if m['role'] == 'assistant' else 'User (defender)'}: {m['content']}"
            for m in history
        )

        assessment_prompt = f"""Debate topic: {session['topic']}
User's position: {session['userPosition']}
AI's position: {session['aiPosition']}
Number of rounds: {session['roundNumber']}

Full debate:
{conversation_text}

Evaluate the user's argumentation skills based on this debate."""

        assessment = await gemini_service.generate_json(
            DEBATE_ASSESSMENT_PROMPT, assessment_prompt, max_output_tokens=4096
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


debate_service = DebateService()
