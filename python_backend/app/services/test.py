from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from pydantic import BaseModel
import json
from app.core.utils import parse_db_json
from app.core.config import settings

from app.db.database import prisma
from app.services.ai.test_generation import test_generation_service
from app.schemas.tests import GenerateTestRequest, SubmitTestRequest, AnswerItem

class XP_VALUES:
    CORRECT_ANSWER = 10
    TEST_COMPLETED = 50
    PERFECT_SCORE = 100
    STREAK_BONUS = 25

class TestService:
    async def generate_test(self, user_id: str, params: GenerateTestRequest, extra_context: Optional[str] = None, input_blocks: Optional[list] = None):
        generated = await test_generation_service.generate(
            user_id=user_id,
            params=params, extra_context=extra_context, input_blocks=input_blocks
        )

        # Persist all questions and their real topics together. Mixed tests must not
        # collapse every question into an artificial "General" topic.
        async with prisma.tx() as db:
            await db.query_raw('SELECT id FROM "Subject" WHERE id = $1 FOR UPDATE', str(params.subjectId))
            topics = {}
            questions_data = []
            for i, q in enumerate(generated.questions):
                topic_name = params.topic or q.topic or 'Общее'
                if topic_name not in topics:
                    topic = await db.topic.find_first(where={"subjectId": str(params.subjectId), "name": topic_name})
                    if not topic:
                        topic = await db.topic.create(data={"name": topic_name, "subjectId": str(params.subjectId)})
                    topics[topic_name] = topic.id
                questions_data.append({
                    "type": q.type.value, "question": q.question,
                    "options": json.dumps(q.options or []),
                    "correctAnswer": json.dumps(q.correctAnswer),
                    "explanation": q.explanation, "difficulty": q.difficulty.value,
                    "orderIndex": i, "topicId": topics[topic_name],
                })
            test = await db.test.create(data={
                "title": generated.title, "generatedBy": "gemini",
                "subjectId": str(params.subjectId), "topic": params.topic,
                "difficulty": params.difficulty.value,
                "questionCount": len(generated.questions),
                "questionTypes": [qt.value for qt in params.questionTypes],
                "questions": {"create": questions_data},
            }, include={"questions": {"orderBy": {"orderIndex": "asc"}}})

        # Return test WITHOUT correct answers (security)
        questions_safe = []
        if test.questions:
            for q in test.questions:
                options = parse_db_json(q.options) if q.options else []
                questions_safe.append({
                    "id": q.id,
                    "type": q.type,
                    "question": q.question,
                    "options": options,
                    "difficulty": q.difficulty,
                    "orderIndex": q.orderIndex,
                })

        return {
            "id": test.id,
            "title": test.title,
            "topic": test.topic,
            "difficulty": test.difficulty,
            "questionCount": test.questionCount,
            "questions": questions_safe
        }

    async def get_test(self, test_id: str, include_answers: bool = False):
        test = await prisma.test.find_unique(  # type: ignore
            where={"id": test_id},
            include={
                "questions": {"orderBy": {"orderIndex": "asc"}},
                "subject": True
            }
        )

        if not test:
            raise HTTPException(status_code=404, detail="Test not found")

        questions = []
        if test.questions:
            for q in test.questions:
                q_dict = {
                    "id": q.id,
                    "type": q.type,
                    "question": q.question,
                    "options": parse_db_json(q.options) if q.options else [],
                    "difficulty": q.difficulty,
                    "orderIndex": q.orderIndex,
                }
                if include_answers:
                    q_dict["correctAnswer"] = parse_db_json(q.correctAnswer) if q.correctAnswer else None
                    q_dict["explanation"] = q.explanation
                questions.append(q_dict)

        return {
            "id": test.id,
            "title": test.title,
            "subjectId": test.subjectId,
            "topic": test.topic,
            "difficulty": test.difficulty,
            "questionCount": test.questionCount,
            "questionTypes": test.questionTypes,
            "subject": {"id": test.subject.id, "name": test.subject.name} if test.subject else None,
            "questions": questions
        }

    async def start_attempt(self, user_id: str, test_id: str):
        test = await prisma.test.find_unique(where={"id": test_id})
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")

        async with prisma.tx() as db:
            await db.query_raw('SELECT id FROM "User" WHERE id = $1 FOR UPDATE', user_id)
            existing = await db.attempt.find_first(
                where={"userId": user_id, "testId": test_id, "status": "IN_PROGRESS"}
            )
            if existing:
                return existing
            return await db.attempt.create(data={"userId": user_id, "testId": test_id})

    async def save_progress(self, attempt_id: str, user_id: str, progress: Any):
        async with prisma.tx() as db:
            await db.query_raw('SELECT id FROM "User" WHERE id = $1 FOR UPDATE', user_id)
            attempt = await db.attempt.find_unique(where={"id": attempt_id}, include={"test": {"include": {"questions": True}}})
            if not attempt or attempt.userId != user_id:
                raise HTTPException(status_code=404, detail="Attempt not found")
            if attempt.status != "IN_PROGRESS":
                raise HTTPException(status_code=400, detail="Attempt already completed")
            question_ids = {q.id for q in attempt.test.questions or []}
            if (set(progress['answers']) | set(progress['timeSpent'])) - question_ids:
                raise HTTPException(400, "Прогресс содержит вопросы другого теста")
            if progress['currentIdx'] >= len(question_ids):
                raise HTTPException(400, "Вопрос не найден в этом тесте")
            return await db.attempt.update(
                where={"id": attempt_id}, data={"savedProgress": json.dumps(progress)}
            )

    async def submit_attempt(self, attempt_id: str, user_id: str, payload: SubmitTestRequest):
        async with prisma.tx(timeout=15000) as db:
            # Serialize submissions for the same student, including different tests:
            # topic progress, streaks and XP must be updated together with answers.
            await db.query_raw('SELECT id FROM "User" WHERE id = $1 FOR UPDATE', user_id)
            return await self._submit_attempt(db, attempt_id, user_id, payload)

    async def _submit_attempt(self, db, attempt_id: str, user_id: str, payload: SubmitTestRequest):
        attempt = await db.attempt.find_unique(
            where={"id": attempt_id},
            include={
                "test": {
                    "include": {
                        "questions": True,
                        "subject": True
                    }
                }
            }
        )

        if not attempt or attempt.userId != user_id:
            raise HTTPException(status_code=404, detail="Attempt not found")
        if attempt.status != "IN_PROGRESS":
            raise HTTPException(status_code=400, detail="Попытка уже завершена или отменена")

        correct_count = 0
        wrong_count = 0
        skipped_count = 0

        answer_records = []
        
        questions = attempt.test.questions if attempt.test and attempt.test.questions else []
        answers_by_id = {str(answer.questionId): answer for answer in payload.answers}
        question_ids = {question.id for question in questions}
        if set(answers_by_id) - question_ids:
            raise HTTPException(400, "Ответ содержит вопрос, которого нет в этом тесте")
        for question in questions:
            ans = answers_by_id.get(question.id) or AnswerItem(questionId=question.id)

            if ans.userAnswer is None or (isinstance(ans.userAnswer, list) and len(ans.userAnswer) == 0) or (isinstance(ans.userAnswer, str) and not ans.userAnswer.strip()):
                skipped_count += 1
                answer_records.append({
                    "attemptId": attempt_id,
                    "questionId": str(ans.questionId),
                    "userAnswer": json.dumps(ans.userAnswer),
                    "isCorrect": False,
                    "timeSpent": ans.timeSpent
                })
                continue

            correct_ans_parsed = parse_db_json(question.correctAnswer) if question.correctAnswer else []
            is_correct = self._check_answer(ans.userAnswer, correct_ans_parsed)
            if is_correct:
                correct_count += 1
            else:
                wrong_count += 1

            answer_records.append({
                "attemptId": attempt_id,
                "questionId": str(ans.questionId),
                "userAnswer": json.dumps(ans.userAnswer),
                "isCorrect": is_correct,
                "timeSpent": ans.timeSpent
            })

        # Insert answers
        for ans_record in answer_records:
            existing_ans = await db.answer.find_first(
                where={"attemptId": ans_record["attemptId"], "questionId": ans_record["questionId"]}
            )
            if existing_ans:
                await db.answer.update(
                    where={"id": existing_ans.id},
                    data={
                        "userAnswer": ans_record["userAnswer"],
                        "isCorrect": ans_record["isCorrect"],
                        "timeSpent": ans_record["timeSpent"]
                    }
                )
            else:
                await db.answer.create(data=ans_record)

        total_questions = len(questions)
        percentage = (correct_count / total_questions) * 100 if total_questions > 0 else 0
        percentage = round(percentage * 100) / 100

        updated_attempt = await db.attempt.update(  # type: ignore
            where={"id": attempt_id},
            data={
                "status": "COMPLETED",
                "score": correct_count,
                "percentage": percentage,
                "correctCount": correct_count,
                "wrongCount": wrong_count,
                "skippedCount": skipped_count,
                "totalTime": payload.totalTime,
                "completedAt": datetime.now(timezone.utc)
            },
            include={
                "test": {"include": {"subject": True}},
                "answers": {"include": {"question": True}}
            }
        )

        await self._update_progress(user_id, attempt.test, answer_records, db=db)
        await self._update_gamification(user_id, correct_count, percentage, db=db)

        # Record study session
        if attempt.test and attempt.test.subject:
            xp_earned = correct_count * XP_VALUES.CORRECT_ANSWER + XP_VALUES.TEST_COMPLETED
            if percentage == 100:
                xp_earned += XP_VALUES.PERFECT_SCORE
                
            await db.studysession.create(  # type: ignore
                data={
                    "userId": user_id,
                    "subjectName": attempt.test.subject.name,
                    "topicName": attempt.test.topic,
                    "activityType": "test",
                    "duration": payload.totalTime,
                    "xpEarned": xp_earned
                }
            )

        from app.services.achievements import achievements_service
        await achievements_service.award(db, user_id)
        return updated_attempt

    def _check_answer(self, user_answer: Any, correct_answer: Any) -> bool:
        def normalize(v: Any) -> List[str]:
            if isinstance(v, list):
                return sorted([str(x).strip().lower() for x in v])
            return [str(v).strip().lower()]

        user_norm = normalize(user_answer)
        correct_norm = normalize(correct_answer)

        if len(user_norm) != len(correct_norm):
            return False
        
        return all(u == c for u, c in zip(user_norm, correct_norm))

    async def _update_progress(self, user_id: str, test: Any, answers: List[Dict[str, Any]], db):
        topic_results = {}

        for ans in answers:
            question = next((q for q in test.questions if q.id == ans["questionId"]), None)
            if not question:
                continue

            topic_id = question.topicId or 'general'
            if topic_id not in topic_results:
                topic_results[topic_id] = {"correct": 0, "total": 0}
            
            topic_results[topic_id]["total"] += 1
            if ans["isCorrect"]:
                topic_results[topic_id]["correct"] += 1

        for topic_id, results in topic_results.items():
            if topic_id == 'general':
                continue # Only track real topics
                
            existing = await db.topicprogress.find_first(
                where={"userId": user_id, "topicId": topic_id}
            )

            total_attempts = (existing.totalAttempts if existing else 0) + results["total"]
            correct_answers = (existing.correctAnswers if existing else 0) + results["correct"]
            wrong_answers = (existing.wrongAnswers if existing else 0) + (results["total"] - results["correct"])
            mastery_score = (correct_answers / total_attempts) * 100 if total_attempts > 0 else 0
            mastery_level = self._get_mastery_level(mastery_score)

            session_score = results["correct"] / results["total"] if results["total"] > 0 else 0
            ease_factor = existing.easeFactor if existing else 2.5
            review_interval = existing.reviewInterval if existing else 1

            if session_score >= 0.8:
                ease_factor = max(1.3, ease_factor + 0.1)
                review_interval = max(1, round(review_interval * ease_factor))
            elif session_score < 0.5:
                ease_factor = max(1.3, ease_factor - 0.2)
                review_interval = 1

            next_review_at = datetime.now(timezone.utc) + timedelta(days=review_interval)

            if existing:
                await db.topicprogress.update(  # type: ignore
                    where={"id": existing.id},
                    data={
                        "masteryScore": float(mastery_score),
                        "masteryLevel": mastery_level,
                        "totalAttempts": total_attempts,
                        "correctAnswers": correct_answers,
                        "wrongAnswers": wrong_answers,
                        "lastStudiedAt": datetime.now(timezone.utc),
                        "nextReviewAt": next_review_at,
                        "reviewInterval": int(review_interval),
                        "easeFactor": float(ease_factor)
                    }
                )
            else:
                await db.topicprogress.create(  # type: ignore
                    data={
                        "userId": user_id,
                        "topicId": topic_id,
                        "masteryScore": float(mastery_score),
                        "masteryLevel": mastery_level,
                        "totalAttempts": total_attempts,
                        "correctAnswers": correct_answers,
                        "wrongAnswers": wrong_answers,
                        "lastStudiedAt": datetime.now(timezone.utc),
                        "nextReviewAt": next_review_at,
                        "reviewInterval": int(review_interval),
                        "easeFactor": float(ease_factor),
                        "currentDifficulty": test.difficulty
                    }
                )

    def _get_mastery_level(self, score: float) -> str:
        if score >= 95: return 'MASTERED'
        if score >= 80: return 'STRONG'
        if score >= 60: return 'GOOD'
        if score >= 30: return 'DEVELOPING'
        return 'BEGINNER'

    async def _update_gamification(self, user_id: str, correct_count: int, percentage: float, db):
        profile = await db.studentprofile.find_unique(where={"userId": user_id})
        if not profile:
            return

        xp_earned = XP_VALUES.TEST_COMPLETED + correct_count * XP_VALUES.CORRECT_ANSWER
        if percentage == 100:
            xp_earned += XP_VALUES.PERFECT_SCORE

        now = datetime.now(timezone.utc)
        school_zone = ZoneInfo(settings.SCHOOL_TIMEZONE)
        today = now.astimezone(school_zone).date()
        last_study = profile.lastStudyDate.astimezone(school_zone).date() if profile.lastStudyDate else None

        new_streak = profile.streak
        if not last_study or last_study < today - timedelta(days=1):
            new_streak = 1
        elif last_study < today:
            new_streak = profile.streak + 1
            xp_earned += XP_VALUES.STREAK_BONUS

        await db.studentprofile.update(
            where={"userId": user_id},
            data={
                "xp": profile.xp + xp_earned,
                "streak": new_streak,
                "bestStreak": max(new_streak, profile.bestStreak),
                "lastStudyDate": now
            }
        )

test_service = TestService()
