import base64
from datetime import datetime
from zoneinfo import ZoneInfo
import unittest
from pydantic import ValidationError
from app.schemas.companion import ChatRequest, QuizQuestion, TaskInput
from app.services.companion import next_lesson, public_quiz, normalize_answer, teaching_prompt


class CompanionTests(unittest.TestCase):
    def test_current_and_next_lesson(self):
        items = [{'id': 'later', 'startTime': '11:00', 'endTime': '11:45'}, {'id': 'now', 'startTime': '10:00', 'endTime': '10:45'}]
        now = datetime(2026, 10, 8, 10, 20, tzinfo=ZoneInfo('Asia/Almaty'))
        self.assertEqual(next_lesson(items, now)['id'], 'now')
        between = now.replace(minute=50)
        self.assertEqual(next_lesson(items, between)['minutesUntil'], 10)
        self.assertIsNone(next_lesson(items, now.replace(hour=12)))

    def test_quiz_never_exposes_unanswered_answers(self):
        quiz = {'questions': [{'question': 'Q1', 'answer': 'A1', 'explanation': 'E1'}, {'question': 'Q2', 'answer': 'A2', 'explanation': 'E2'}], 'answers': [{'answer': 'A1', 'correct': True}]}
        public = public_quiz(quiz)
        self.assertEqual(public['questions'][0]['answer'], 'A1')
        self.assertNotIn('answer', public['questions'][1])
        self.assertNotIn('explanation', public['questions'][1])
        self.assertIn('answer', quiz['questions'][1])  # no mutation of persisted data

    def test_invalid_answer_key_rejected(self):
        with self.assertRaises(ValidationError):
            QuizQuestion(question='Q', answer='C', options=['A','B'], type='multiple_choice', explanation='E', topic='T')

    def test_image_validation(self):
        for value in ['data:image/svg+xml;base64,YWJj', 'https://localhost/private', 'data:image/png;base64,YWJj']:
            with self.assertRaises(ValidationError):
                ChatRequest(message='Q', image=value)
        image='data:image/png;base64,'+base64.b64encode(b'\x89PNG\r\n\x1a\nheader').decode()
        self.assertEqual(ChatRequest(message='Q', image=image).image, image)

    def test_languages_and_grade_in_prompt(self):
        for language, name in [('ru','Russian'),('en','English'),('de','German'),('uk','Ukrainian')]:
            prompt=teaching_prompt(ChatRequest(message='Q',grade=8,language=language), 'homework')
            self.assertIn(name,prompt)
            self.assertIn('Grade 8',prompt)
            self.assertIn('numbered solution steps',prompt)

    def test_short_answers(self):
        self.assertEqual(normalize_answer('  BERLIN. '),normalize_answer('Berlin'))
        self.assertNotEqual(normalize_answer('3'),normalize_answer('4'))

    def test_deadline_requires_timezone(self):
        with self.assertRaises(ValidationError):
            TaskInput(title='T',kind='test',dueAt='2026-10-08T10:30:00')
