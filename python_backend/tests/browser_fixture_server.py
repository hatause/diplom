"""Local browser QA API: real DB/services, deterministic Gemini transport.

Run only with a disposable schedule_test* database seeded with --demo.
PYTHONPATH=python_backend python python_backend/tests/browser_fixture_server.py
"""
import json
import re
from urllib.parse import urlsplit

import httpx
import uvicorn

from app.core.config import settings
from app.services.gemini_service import gemini_service


def provider(request):
    body = json.loads(request.content)
    prompt = '\n'.join(p.get('text', '') for c in body['contents'] for p in c['parts'])
    schema = body['generationConfig'].get('responseJsonSchema', {})
    title = schema.get('title', '')
    count = int((re.search(r'(?:exactly|Number of questions:)\s*(\d+)', prompt) or [None, '5'])[1])
    if title == 'GeneratedTest':
        types = re.search(r'Question types: (.*)', prompt)[1].split(', ')
        questions = []
        for i in range(count):
            kind = types[i % len(types)]
            options = ['4', '5', '6'] if kind in ('single_choice', 'multiple_choice') else ['true', 'false'] if kind == 'true_false' else []
            answer = ['4', '6'] if kind == 'multiple_choice' else 'true' if kind == 'true_false' else '4'
            questions.append(dict(id=f'q{i}', type=kind, question=f'QA вопрос {i + 1}: два плюс два?', options=options,
                                  correctAnswer=answer, explanation='Два плюс два равно четырём.', topic='QA тема', difficulty='medium'))
        output = dict(title='QA тест', subject='Математика', difficulty='medium', questions=questions)
    elif title == 'DeckOutput':
        output = dict(title='QA карточки', cards=[dict(question=f'QA карточка {i + 1}', answer='Четыре') for i in range(count)])
    elif title == 'QuizOutput':
        output = dict(title='QA викторина', questions=[dict(type='short_answer' if i % 3 == 2 else 'true_false' if i % 3 == 1 else 'multiple_choice',
                      question=f'QA вопрос {i + 1}', answer='4', options=[] if i % 3 == 2 else ['4', '5'], explanation='Проверенное объяснение.', topic='QA тема') for i in range(count)])
    else:
        output = dict(summary='QA анализ: материал усвоен.', encouragement='Продолжайте практику.', overallScore=80,
                      scores={key:80 for key in ['conceptUnderstanding','causalReasoning','simpleExplanation','exampleQuality',
                      'exceptionAwareness','logicalCoherence','argumentQuality','logicalReasoning','evidenceUse',
                      'counterargumentHandling','topicUnderstanding','questioningSkill']},
                      **{key:['QA наблюдение'] for key in ['understoodWell','knowledgeGaps','mistakesFound','topicsToReview',
                      'strongPoints','weakPoints','goodArguments','unsupportedClaims','logicalFallacies',
                      'unrefutedCounterarguments','lessonsLearned','topicsToStudy','strengths','weaknesses']},
                      recommendedDifficulty='medium', studyPlan=[dict(step=1, action='Практика', description='Повторить тему')])
    text = json.dumps(output, ensure_ascii=False) if body['generationConfig'].get('responseMimeType') else 'QA ответ: два плюс два равно четырём. Как вы это объясните?'
    return httpx.Response(200, json={'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':text}]}}]})


if __name__ == '__main__':
    if not urlsplit(settings.DATABASE_URL).path.lstrip('/').startswith('schedule_test'):
        raise SystemExit('Browser fixtures require a disposable schedule_test database')
    settings.GEMINI_API_KEY = 'browser-fixture-only'
    settings.ROOM_FINDER_JAVA_URL = ''
    gemini_service._client = httpx.AsyncClient(transport=httpx.MockTransport(provider))
    uvicorn.run('app.main:app', host='127.0.0.1', port=4000, log_level='warning')
