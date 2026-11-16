import unittest

from pydantic import ValidationError

from app.schemas.companion import GenerateMaterial, NoteInput, QuizQuestion, TaskInput


class CompanionValidationTests(unittest.TestCase):
    def test_blank_material_notes_and_tasks_are_rejected(self):
        invalid = [(GenerateMaterial, {'source': ' \n '}),
                   (NoteInput, {'title': ' ', 'content': 'body'}),
                   (NoteInput, {'title': 'Title', 'content': '\n '}),
                   (TaskInput, {'title': ' ', 'kind': 'test', 'dueAt': '2026-12-01T09:00:00+05:00'})]
        for model, values in invalid:
            with self.subTest(model=model.__name__, values=values), self.assertRaises(ValidationError):
                model(**values)

    def test_generated_choices_can_be_submitted_without_exceeding_answer_limit(self):
        base = dict(type='multiple_choice', question='Question', answer='4',
                    options=['4', '5'], explanation='Explanation', topic='Math')
        for values in [dict(options=[' ', '4']), dict(options=['4', 'x' * 2001]),
                       dict(options=['4', '5'], answer='x' * 2001),
                       dict(type='short_answer', options=['4'])]:
            with self.subTest(values=values), self.assertRaises(ValidationError):
                QuizQuestion(**{**base, **values})
