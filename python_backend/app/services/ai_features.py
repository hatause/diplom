"""AI Tutor services — rewritten to match Node.js tutor.service.ts behavior.

Fixes:
- Uses TUTOR_SYSTEM_PROMPT from prompts.py (not hardcoded)
- Passes conversationHistory through gemini_service.chat()
- Loads subject/topic/progress context (as in Node.js)
- analyze_result sends detailed prompt with wrong/correct answers
- explain loads actual student answer (not just question)
- recommendations calls AI with real progress data
"""

import json
import logging
from typing import Optional, List, Dict, Any

from fastapi import HTTPException
from app.db.database import prisma
from app.schemas.ai import AIChatRequest
from app.services.gemini_service import gemini_service
from app.services.prompts import (
    TUTOR_SYSTEM_PROMPT,
    RESULT_ANALYZER_SYSTEM_PROMPT,
    RECOMMENDATION_SYSTEM_PROMPT,
    EXPLANATION_SYSTEM_PROMPT,
)

logger = logging.getLogger(__name__)


class AIService:
    async def chat(self, user_id: str, data: AIChatRequest):
        """AI Tutor chat — mirrors Node.js TutorService.chat()."""

        # Build educational context
        context = ""

        if data.subjectId:
            subject = await prisma.subject.find_unique(
                where={"id": data.subjectId},
                include={"topics": True},
            )
            if subject:
                context += f"Current subject: {subject.name}\n"

            # Fetch related lectures for context
            lectures = await prisma.lecture.find_many(
                where={"subjectId": data.subjectId},
                order={"createdAt": "desc"},
                take=3
            )
            if lectures:
                context += "\nAvailable lectures/materials for this subject:\n"
                for lec in lectures:
                    # Include up to 2000 chars per lecture to give AI enough context to explain it
                    content_preview = lec.content[:2000] + ("..." if len(lec.content) > 2000 else "")
                    context += f"- Title: {lec.title}\nContent: {content_preview}\n\n"

        if data.topicId:
            topic = await prisma.topic.find_unique(where={"id": data.topicId})
            if topic:
                context += f"Current topic: {topic.name}\n"

        # Get student progress summary (weakest areas)
        progress = await prisma.topicprogress.find_many(
            where={"userId": user_id},
            include={"topic": {"include": {"subject": True}}},
            order={"masteryScore": "asc"},
            take=5,
        )

        if progress:
            context += "\nStudent weak areas:\n"
            for p in progress:
                if p.topic and p.topic.subject:
                    context += f"- {p.topic.subject.name} → {p.topic.name}: {round(p.masteryScore)}% mastery\n"

        # Build messages list (includes conversation history)
        messages: List[Dict[str, str]] = []
        if data.conversationHistory:
            for msg in data.conversationHistory:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": content})

        # Append current message with context
        user_message = data.message
        if context:
            user_message = f"[Context: {context}]\n\n{data.message}"
        messages.append({"role": "user", "content": user_message})

        # Call Gemini with chat (multi-turn conversation)
        response = await gemini_service.chat(
            TUTOR_SYSTEM_PROMPT, messages
        )

        # Log AI interaction
        try:
            await prisma.aiinteraction.create(
                data={
                    "userId": user_id,
                    "type": "tutor_chat",
                    "prompt": data.message[:500],
                    "response": response[:1000],
                    "model": "gemini",
                    "subjectName": data.subjectId or None,
                }
            )  # type: ignore
        except Exception as e:
            logger.warning("Failed to log AI interaction: %s", e)

        return {"message": response}

    async def analyze_result(self, user_id: str, attempt_id: str):
        """Analyze test result — mirrors Node.js ResultAnalysisService.analyze()."""

        attempt = await prisma.attempt.find_unique(
            where={"id": attempt_id},
            include={
                "test": {"include": {"subject": True}},
                "answers": {"include": {"question": {"include": {"topic": True}}}},
            },
        )
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found")

        wrong_answers = [a for a in (attempt.answers or []) if not a.isCorrect]
        correct_answers = [a for a in (attempt.answers or []) if a.isCorrect]

        subject_name = attempt.test.subject.name if attempt.test and attempt.test.subject else "Unknown"
        topic_name = attempt.test.topic if attempt.test else "General"
        difficulty = attempt.test.difficulty if attempt.test else "medium"
        total_answers = len(attempt.answers or [])

        wrong_details = "\n".join(
            f"- {a.question.topic.name if a.question and a.question.topic else 'General'}: "
            f"\"{a.question.question if a.question else '?'}\" "
            f"(answered: {json.dumps(a.userAnswer)}, correct: {json.dumps(a.question.correctAnswer) if a.question else '?'})"
            for a in wrong_answers
            if a.question
        )

        correct_details = "\n".join(
            f"- {a.question.topic.name if a.question and a.question.topic else 'General'}: "
            f"\"{a.question.question if a.question else '?'}\""
            for a in correct_answers
            if a.question
        )

        prompt = f"""Analyze this test result:
- Subject: {subject_name}
- Topic: {topic_name}
- Score: {attempt.percentage}%
- Correct: {attempt.correctCount}/{total_answers}
- Difficulty: {difficulty}

Wrong answers by topic:
{wrong_details}

Correct answers by topic:
{correct_details}"""

        analysis = await gemini_service.generate_json(
            RESULT_ANALYZER_SYSTEM_PROMPT, prompt
        )

        # Save analysis to attempt
        await prisma.attempt.update(
            where={"id": attempt_id},
            data={"aiAnalysis": analysis},
        )

        # Log AI interaction
        try:
            await prisma.aiinteraction.create(
                data={
                    "userId": user_id,
                    "type": "result_analysis",
                    "prompt": prompt[:500],
                    "response": json.dumps(analysis)[:1000] if isinstance(analysis, dict) else str(analysis)[:1000],
                    "model": "gemini",
                    "subjectName": subject_name,
                }
            )  # type: ignore
        except Exception as e:
            logger.warning("Failed to log AI interaction: %s", e)

        return {"analysis": analysis}

    async def explain(self, user_id: str, question_id: str, attempt_id: str):
        """Explain a question — mirrors Node.js ExplanationService.explain()."""

        # Find the actual answer (student's response), not just the question
        answer = await prisma.answer.find_first(
            where={"questionId": question_id, "attemptId": attempt_id},
            include={"question": {"include": {"topic": True}}},
        )

        if not answer or not answer.question:
            raise HTTPException(status_code=404, detail="Answer not found")

        prompt = f"""Question: {answer.question.question}
Student's answer: {json.dumps(answer.userAnswer)}
Correct answer: {json.dumps(answer.question.correctAnswer)}
Original explanation: {answer.question.explanation or 'None provided'}
Topic: {answer.question.topic.name if answer.question.topic else 'General'}"""

        response = await gemini_service.generate_text(
            EXPLANATION_SYSTEM_PROMPT, prompt
        )
        return {"explanation": response}

    async def get_recommendations(self, user_id: str):
        """Get AI recommendations — mirrors Node.js RecommendationService."""

        progress = await prisma.topicprogress.find_many(
            where={"userId": user_id},
            include={"topic": {"include": {"subject": True}}},
            order={"masteryScore": "asc"},
        )

        recent_attempts = await prisma.attempt.find_many(
            where={"userId": user_id, "status": "COMPLETED"},
            order={"completedAt": "desc"},
            take=5,
            include={"test": {"include": {"subject": True}}},
        )

        # Build detailed prompt for AI
        progress_lines = "\n".join(
            f"- {p.topic.subject.name if p.topic and p.topic.subject else '?'} → "
            f"{p.topic.name if p.topic else '?'}: {round(p.masteryScore)}% "
            f"(last: {p.lastStudiedAt.strftime('%Y-%m-%d') if p.lastStudiedAt else 'never'})"
            for p in progress[:10]
        )

        attempts_lines = "\n".join(
            f"- {a.test.subject.name if a.test and a.test.subject else '?'}: "
            f"{a.percentage}% ({a.test.difficulty if a.test else '?'})"
            for a in recent_attempts
        )

        if not progress_lines and not attempts_lines:
            return {"recommendations": [{"subject": "General", "topic": "Start learning", "reason": "No data yet", "priority": "high", "suggestedDifficulty": "easy"}], "dailySuggestion": "Start by taking your first test!"}

        prompt = f"""Based on this student's performance, suggest what to study:

Topic progress (weakest first):
{progress_lines}

Recent tests:
{attempts_lines}"""

        result = await gemini_service.generate_json(
            RECOMMENDATION_SYSTEM_PROMPT, prompt
        )
        return result


ai_service = AIService()

