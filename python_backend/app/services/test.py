from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from pydantic import BaseModel
import json
from app.core.utils import parse_db_json

from app.db.database import prisma
from app.services.ai.test_generation import test_generation_service
from app.schemas.tests import GenerateTestRequest, SubmitTestRequest, AnswerItem

class XP_VALUES:
    CORRECT_ANSWER = 10
    TEST_COMPLETED = 50
    PERFECT_SCORE = 100
    STREAK_BONUS = 25

class TestService:
    async def generate_test(self, user_id: str, params: GenerateTestRequest):
        generated = await test_generation_service.generate(
            user_id=user_id,
            params=params
        )

        topic_name = params.topic or 'Общее'
        
        # Upsert topic
        existing_topic = await prisma.topic.find_first(
            where={"subjectId": str(params.subjectId), "name": topic_name}
        )
        if not existing_topic:
            topic = await prisma.topic.create(  # type: ignore
                data={"name": topic_name, "subjectId": str(params.subjectId)}
            )
        else:
            topic = existing_topic
            
        topic_id = topic.id

        # Store test and questions in DB
        questions_data = []
        for i, q in enumerate(generated.questions):
            questions_data.append({
                "type": q.type.value,
                "question": q.question,
                "options": json.dumps(q.options) if q.options else json.dumps([]),
                "correctAnswer": json.dumps(q.correctAnswer),
                "explanation": q.explanation,
                "difficulty": q.difficulty.value,
                "orderIndex": i,
                "topicId": topic_id,
            })

        test = await prisma.test.create(  # type: ignore
            data={
                "title": generated.title,
                "generatedBy": "gemini",
                "subjectId": str(params.subjectId),
                "topic": params.topic,
                "difficulty": params.difficulty.value,
                "questionCount": len(generated.questions),
                "questionTypes": [qt.value for qt in params.questionTypes],
                "questions": {
                    "create": questions_data
                }
            },
            include={"questions": {"orderBy": {"orderIndex": "asc"}}}  # type: ignore
        )

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

        existing = await prisma.attempt.find_first(  # type: ignore
            where={"userId": user_id, "testId": test_id, "status": "IN_PROGRESS"}
        )
        if existing:
            return existing

        return await prisma.attempt.create(  # type: ignore
            data={"userId": user_id, "testId": test_id}
        )

    async def save_progress(self, attempt_id: str, user_id: str, progress: Any):
        attempt = await prisma.attempt.find_unique(where={"id": attempt_id})
        if not attempt or attempt.userId != user_id:
            raise HTTPException(status_code=404, detail="Attempt not found")
        if attempt.status != "IN_PROGRESS":
            raise HTTPException(status_code=400, detail="Attempt already completed")

        return await prisma.attempt.update(  # type: ignore
            where={"id": attempt_id},
            data={"savedProgress": json.dumps(progress)}
        )

    async def submit_attempt(self, attempt_id: str, user_id: str, payload: SubmitTestRequest):
        attempt = await prisma.attempt.find_unique(
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
        if attempt.status == "COMPLETED":
            raise HTTPException(status_code=400, detail="Attempt already submitted")

        correct_count = 0
        wrong_count = 0
        skipped_count = 0

        answer_records = []
        
        questions = attempt.test.questions if attempt.test and attempt.test.questions else []
        for ans in payload.answers:
            question = next((q for q in questions if q.id == str(ans.questionId)), None)
            if not question:
                continue

            if ans.userAnswer is None or (isinstance(ans.userAnswer, list) and len(ans.userAnswer) == 0) or ans.userAnswer == "":
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
            existing_ans = await prisma.answer.find_first(
                where={"attemptId": ans_record["attemptId"], "questionId": ans_record["questionId"]}
            )
            if existing_ans:
                await prisma.answer.update(
                    where={"id": existing_ans.id},
                    data={
                        "userAnswer": ans_record["userAnswer"],
                        "isCorrect": ans_record["isCorrect"],
                        "timeSpent": ans_record["timeSpent"]
                    }
                )
            else:
                await prisma.answer.create(data=ans_record)

        total_questions = len(questions)
        percentage = (correct_count / total_questions) * 100 if total_questions > 0 else 0
        percentage = round(percentage * 100) / 100

        updated_attempt = await prisma.attempt.update(  # type: ignore
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

        await self._update_progress(user_id, attempt.test, answer_records)
        await self._update_gamification(user_id, correct_count, percentage)

        # Record study session
        if attempt.test and attempt.test.subject:
            xp_earned = correct_count * XP_VALUES.CORRECT_ANSWER + XP_VALUES.TEST_COMPLETED
            if percentage == 100:
                xp_earned += XP_VALUES.PERFECT_SCORE
                
            await prisma.studysession.create(  # type: ignore
                data={
                    "userId": user_id,
                    "subjectName": attempt.test.subject.name,
                    "topicName": attempt.test.topic,
                    "activityType": "test",
                    "duration": payload.totalTime,
                    "xpEarned": xp_earned
                }
            )

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

    async def _update_progress(self, user_id: str, test: Any, answers: List[Dict[str, Any]]):
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
                
            existing = await prisma.topicprogress.find_first(
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
                await prisma.topicprogress.update(  # type: ignore
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
                await prisma.topicprogress.create(  # type: ignore
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

    async def _update_gamification(self, user_id: str, correct_count: int, percentage: float):
        profile = await prisma.studentprofile.find_unique(where={"userId": user_id})
        if not profile:
            return

        xp_earned = XP_VALUES.TEST_COMPLETED + correct_count * XP_VALUES.CORRECT_ANSWER
        if percentage == 100:
            xp_earned += XP_VALUES.PERFECT_SCORE

        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        last_study = profile.lastStudyDate.replace(hour=0, minute=0, second=0, microsecond=0) if profile.lastStudyDate else None

        new_streak = profile.streak
        if not last_study or last_study < today - timedelta(days=1):
            new_streak = 1
        elif last_study < today:
            new_streak = profile.streak + 1
            xp_earned += XP_VALUES.STREAK_BONUS

        await prisma.studentprofile.update(
            where={"userId": user_id},
            data={
                "xp": profile.xp + xp_earned,
                "streak": new_streak,
                "bestStreak": max(new_streak, profile.bestStreak),
                "lastStudyDate": datetime.now(timezone.utc)
            }
        )

test_service = TestService()
