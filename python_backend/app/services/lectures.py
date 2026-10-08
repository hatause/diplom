from fastapi import HTTPException
from app.db.database import prisma
from app.schemas.lectures import LectureCreate
from app.schemas.tests import GenerateTestRequest
from app.services.test import test_service

class LecturesService:
    async def get_public_lectures(self):
        lectures = await prisma.lecture.find_many(
            where={"groupId": None}, # type: ignore
            include={
                "teacher": True,
                "subject": True
            },
            order={"createdAt": "desc"}
        )
        return self._format_lectures(lectures)

    async def get_group_lectures(self, group_id: str):
        lectures = await prisma.lecture.find_many(
            where={"groupId": group_id},
            include={
                "teacher": True,
                "subject": True
            },
            order={"createdAt": "desc"}
        )
        return self._format_lectures(lectures)

    async def get_lecture(self, lecture_id: str):
        lecture = await prisma.lecture.find_unique(
            where={"id": lecture_id},
            include={
                "teacher": True,
                "subject": True
            }
        ) # type: ignore
        if not lecture:
            raise HTTPException(status_code=404, detail="Lecture not found")
        
        return self._format_lecture(lecture)

    async def create_lecture(self, user_id: str, data: LectureCreate):
        group_id = data.groupId if data.groupId and data.groupId.strip() else None
        lecture = await prisma.lecture.create(
            data={
                "title": data.title,
                "content": data.content,
                "groupId": group_id,
                "subjectId": data.subjectId,
                "teacherId": user_id,
                "fileUrl": data.fileUrl,
                "fileName": data.fileName
            }
        ) # type: ignore
        return lecture.model_dump()

    async def explain_lecture(self, lecture_id: str, user_id: str):
        lecture = await prisma.lecture.find_unique(where={"id": lecture_id})
        if not lecture:
            raise HTTPException(status_code=404, detail="Lecture not found")
        
        from app.services.gemini_service import gemini_service
        
        system_prompt = "Вы опытный преподаватель. Перескажите и объясните следующую лекцию простым, понятным языком, выделив главные мысли и концепции. Используйте форматирование markdown для лучшей читаемости."
        user_prompt = f"Название лекции: {lecture.title}\n\nТекст лекции:\n{lecture.content}"

        explanation = await gemini_service.generate_text(system_prompt, user_prompt)

        await prisma.aiinteraction.create(
            data={
                "userId": user_id,
                "type": "LECTURE_EXPLANATION",
                "prompt": user_prompt[:500],
                "response": explanation,
                "model": gemini_service.model
            }
        ) # type: ignore

        return {"explanation": explanation}

    async def generate_test(self, lecture_id: str, user_id: str):
        lecture = await prisma.lecture.find_unique(where={"id": lecture_id})
        if not lecture:
            raise HTTPException(status_code=404, detail="Lecture not found")

        from app.schemas.tests import Difficulty, QuestionType
        
        req = GenerateTestRequest(
            subjectId=lecture.subjectId,
            topic=lecture.title,
            difficulty=Difficulty.medium,
            questionCount=5,
            questionTypes=[QuestionType.single_choice, QuestionType.multiple_choice, QuestionType.true_false],
            extraContext=lecture.content
        )
        
        test = await test_service.generate_test(user_id=user_id, params=req)
        return test

    def _format_lectures(self, lectures):
        return [self._format_lecture(l) for l in lectures]
        
    def _format_lecture(self, lecture):
        d = lecture.model_dump()
        if d.get("teacher"):
            d["teacher"] = {"firstName": d["teacher"]["firstName"], "lastName": d["teacher"]["lastName"]}
        if d.get("subject"):
            d["subject"] = {"name": d["subject"]["name"]}
        return d

lectures_service = LecturesService()
