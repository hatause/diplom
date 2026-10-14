from fastapi import HTTPException
from app.db.database import prisma
from app.schemas.lectures import LectureCreate
from app.schemas.tests import GenerateTestRequest
from app.services.test import test_service
from app.services.access import require_group_access, require_lecture_access
from app.services.lecture_material import lecture_material, read_attachment, attachment_path

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

    async def get_group_lectures(self, group_id: str, user_id: str):
        await require_group_access(group_id, user_id)
        lectures = await prisma.lecture.find_many(
            where={"groupId": group_id},
            include={
                "teacher": True,
                "subject": True
            },
            order={"createdAt": "desc"}
        )
        return self._format_lectures(lectures)

    async def get_lecture(self, lecture_id: str, user_id: str):
        lecture = await prisma.lecture.find_unique(
            where={"id": lecture_id},
            include={
                "teacher": True,
                "subject": True
            }
        ) # type: ignore
        if not lecture:
            raise HTTPException(status_code=404, detail="Lecture not found")
        
        await require_lecture_access(lecture, user_id)
        return self._format_lecture(lecture)

    async def create_lecture(self, user_id: str, data: LectureCreate):
        group_id = data.groupId if data.groupId and data.groupId.strip() else None
        if not await prisma.subject.find_unique(where={"id": data.subjectId}):
            raise HTTPException(404, "Предмет не найден. Выберите существующий предмет.")
        if group_id and not await prisma.group.find_unique(where={"id": group_id}):
            raise HTTPException(404, "Группа не найдена.")
        if group_id:
            await require_group_access(group_id, user_id)
        owner = await prisma.user.find_unique(where={"id": user_id})
        subject = await prisma.subject.find_unique(where={"id": data.subjectId})
        if owner.role != "ADMIN" and subject.teacherId != user_id:
            raise HTTPException(403, "Нельзя публиковать лекции по чужому предмету")
        file_url = data.fileUrl
        if file_url:
            path = attachment_path(file_url)
            file_url = f"/api/v1/uploads/{path.name}"
            # A known URL must not allow republishing another group's private file.
            references = await prisma.lecture.find_many(where={"fileUrl": file_url})
            if references:
                for reference in references:
                    try:
                        await require_lecture_access(reference, user_id)
                        break
                    except HTTPException as exc:
                        if exc.status_code != 403:
                            raise
                else:
                    raise HTTPException(403, "Нет доступа к прикреплённому файлу")
        lecture = await prisma.lecture.create(
            data={
                "title": data.title,
                "content": data.content,
                "groupId": group_id,
                "subjectId": data.subjectId,
                "teacherId": user_id,
                "fileUrl": file_url,
                "fileName": data.fileName
            }
        ) # type: ignore
        return lecture.model_dump()

    async def explain_lecture(self, lecture_id: str, user_id: str):
        lecture = await prisma.lecture.find_unique(where={"id": lecture_id})
        if not lecture:
            raise HTTPException(status_code=404, detail="Lecture not found")
        
        await require_lecture_access(lecture, user_id)
        from app.services.gemini_service import gemini_service
        
        system_prompt = "Вы опытный преподаватель. Перескажите и объясните следующую лекцию простым, понятным языком, выделив главные мысли и концепции. Используйте форматирование markdown для лучшей читаемости."

        material = await lecture_material(lecture)
        user_prompt = f'Объясни лекцию «{lecture.title}» по материалам ниже. Не выдумывай отсутствующее содержимое.'
        explanation = await gemini_service.chat(system_prompt, [{'role': 'user', 'content': [{'type': 'text', 'text': user_prompt}, *material]}])

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

        await require_lecture_access(lecture, user_id)
        from app.schemas.tests import Difficulty, QuestionType
        
        req = GenerateTestRequest(
            subjectId=lecture.subjectId,
            topic=lecture.title,
            difficulty=Difficulty.medium,
            questionCount=5,
            questionTypes=[QuestionType.single_choice, QuestionType.multiple_choice, QuestionType.true_false],
        )
        
        material = await lecture_material(lecture)
        text = '\n\n'.join(b['text'] for b in material if b['type'] == 'text')
        attachments = [b for b in material if b['type'] != 'text']
        test = await test_service.generate_test(user_id=user_id, params=req, extra_context=text, input_blocks=attachments)
        return test

    async def extract_text(self, lecture_id: str, user_id: str):
        lecture = await prisma.lecture.find_unique(where={"id": lecture_id})
        if not lecture:
            raise HTTPException(404, "Lecture not found")
        await require_lecture_access(lecture, user_id)
        blocks = await read_attachment(lecture.fileUrl) if lecture.fileUrl else await lecture_material(lecture)
        if all(b['type'] == 'text' for b in blocks):
            return {"text": '\n\n'.join(b['text'] for b in blocks)}
        from app.services.gemini_service import gemini_service
        text = await gemini_service.chat(
            "Перепиши текст прикреплённого материала. Сохрани заголовки, списки и язык оригинала. "
            "Не добавляй объяснений или выдуманного текста. Неразборчивые места отметь [неразборчиво].",
            [{'role': 'user', 'content': [{'type': 'text', 'text': 'Извлеки текст из файла.'}, *blocks]}],
            max_output_tokens=12000,
        )
        return {"text": text}

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
