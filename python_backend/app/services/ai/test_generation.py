import logging
from typing import List, Optional
from app.db.database import prisma
from app.services.gemini_service import gemini_service
from app.services.ai.prompts import TEST_GENERATOR_SYSTEM_PROMPT
from app.schemas.tests import GeneratedTest, GenerateTestRequest, Difficulty, QuestionType

logger = logging.getLogger(__name__)

class TestGenerationService:
    async def generate(self, user_id: str, params: GenerateTestRequest, extra_context: Optional[str] = None) -> GeneratedTest:
        # Get subject info
        subject = await prisma.subject.find_unique(
            where={"id": str(params.subjectId)},
            include={"topics": True}
        )
        if not subject:
            raise ValueError("Subject not found")

        # Build learning context
        context = await self._build_learning_context(user_id, str(params.subjectId), params.topic)

        # Build user prompt
        available_topics = [t.name for t in subject.topics] if subject.topics else []
        user_prompt = self._build_generation_prompt(
            subject_name=subject.name,
            topic=params.topic or "General",
            difficulty=params.difficulty.value,
            question_count=params.questionCount,
            question_types=[qt.value for qt in params.questionTypes],
            available_topics=available_topics,
            learning_context=context,
            extra_context=extra_context
        )

        # Generate via Gemini and validate/fix via Pydantic
        result = await gemini_service.generate_json(
            system_prompt=TEST_GENERATOR_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            response_model=GeneratedTest,
            max_output_tokens=params.questionCount * 500 + 500
        )
        
        # Pydantic (Instructor-like) validation inside generate_json already ensures correct schema.
        # Fallback fix for missing IDs or difficulty can be added if we were using raw JSON,
        # but Pydantic will complain if missing. We can post-process if needed.
        
        # Ensure all questions have IDs
        for i, q in enumerate(result.questions):
            if not q.id:
                q.id = f"q{i+1}"
            if not q.difficulty:
                q.difficulty = params.difficulty

        return result

    async def _build_learning_context(self, user_id: str, subject_id: str, topic: Optional[str] = None) -> str:
        # Get user's topic progress for this subject
        progress = await prisma.topicprogress.find_many(
            where={
                "userId": user_id,
                "topic": {"is": {"subjectId": subject_id}}
            },
            include={"topic": True},
            order={"masteryScore": "asc"},
            take=10
        )

        # Get recent mistakes
        recent_attempts = await prisma.attempt.find_many(
            where={
                "userId": user_id,
                "test": {"is": {"subjectId": subject_id}},
                "status": "COMPLETED"
            },
            order={"completedAt": "desc"},
            take=3,
            include={
                "answers": {
                    "where": {"isCorrect": False},
                    "include": {
                        "question": {
                            "include": {"topic": True}
                        }
                    },
                    "take": 5
                }
            }
        )

        weak_topics = [
            f"{p.topic.name} ({round(p.masteryScore)}%)" 
            for p in progress if p.masteryScore < 60 and p.topic
        ]

        recent_mistake_topics = []
        for a in recent_attempts:
            if not a.answers:
                continue
            for ans in a.answers:
                if ans.question and ans.question.topic:
                    recent_mistake_topics.append(ans.question.topic.name)

        unique_mistake_topics = list(set(recent_mistake_topics))

        context = "Student learning context:\n"
        if weak_topics:
            context += f"- Weak topics: {', '.join(weak_topics)}\n"
        if unique_mistake_topics:
            context += f"- Recent mistakes in: {', '.join(unique_mistake_topics)}\n"

        # Overall stats (Prisma Python client doesn't support aggregate fully like TS, using manual logic or count)
        overall_count = await prisma.attempt.count(
            where={"userId": user_id, "test": {"is": {"subjectId": subject_id}}, "status": "COMPLETED"}
        )
        
        # Calculate average score manually due to Prisma Python limitations with aggregations
        if overall_count > 0:
            all_attempts = await prisma.attempt.find_many(
                where={"userId": user_id, "test": {"is": {"subjectId": subject_id}}, "status": "COMPLETED"}
            )
            total_percentage = sum(a.percentage or 0 for a in all_attempts)
            avg_percentage = total_percentage / len(all_attempts) if all_attempts else 0
            
            context += f"- Tests completed: {overall_count}\n"
            context += f"- Average score: {round(avg_percentage)}%\n"

        return context

    def _build_generation_prompt(
        self, subject_name: str, topic: str, difficulty: str,
        question_count: int, question_types: List[str],
        available_topics: List[str], learning_context: str, extra_context: Optional[str]
    ) -> str:
        prompt = f"""Generate a test with the following parameters:
- Subject: {subject_name}
- Topic: {topic}
- Difficulty: {difficulty}
- Number of questions: {question_count}
- Question types: {', '.join(question_types)}
- Available topics in this subject: {', '.join(available_topics)}

{learning_context}
"""
        if extra_context:
            prompt += f"\nADDITIONAL CONTEXT (e.g. LECTURE MATERIAL):\n{extra_context}\n\nPlease generate questions specifically covering the above additional context.\n"
        
        prompt += f"""
IMPORTANT: 
- Focus more on the student's weak areas
- Do NOT repeat questions the student has already seen
- Generate exactly {question_count} questions
- Distribute question types: {', '.join(question_types)}"""

        return prompt

test_generation_service = TestGenerationService()
