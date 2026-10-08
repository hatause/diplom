# Python backend Aituto

Текущий сервер — FastAPI + Prisma Python + PostgreSQL. React обращается к `/api/v1` через Vite proxy на порт 4000. Старый каталог `backend/` содержит Node.js-сервер; существующий корневой Docker Compose ещё использует его. Для изменений School Companion запускайте Python напрямую.

Из корня проекта, после установки зависимостей и генерации Prisma-клиента:

```sh
python3 -m venv .venv
.venv/bin/pip install -r python_backend/requirements.txt
.venv/bin/prisma generate --schema python_backend/schema.prisma
.venv/bin/python -m uvicorn app.main:app --app-dir python_backend --host 127.0.0.1 --port 4000
```

Требуется существующая PostgreSQL с таблицами из `python_backend/schema.prisma`. Запуск сервера не удаляет, не заполняет и не меняет схему базы автоматически.

Настройки в `python_backend/.env`: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL` (по умолчанию `gemini-2.5-flash`), `SCHOOL_TIMEZONE` (Asia/Almaty), `CORS_ORIGIN` (список через запятую), `AI_TIMEOUT_SECONDS` (90). В production задайте собственные секреты, `NODE_ENV=production` и HTTPS. Ключ Gemini используется только сервером и передаётся в заголовке запроса.

## School Companion API

Все маршруты ниже требуют Bearer access token и активного пользователя. Префикс `/api/v1/companion`:

| Метод и путь | Назначение |
|---|---|
| GET `/dashboard` | Расписание группы, задания, учебная активность, результаты |
| GET `/status` | Наличие настроенного ключа (не проверка доступности провайдера) |
| POST `/chat` | Tutor, homework, study, term; история и изображение PNG/JPEG/WebP до 4 МБ |
| POST `/decks`, `/quizzes` | Генерация 3–15 карточек/вопросов по материалу |
| POST `/decks/{id}/review` | Отметка изученной карточки |
| POST `/quizzes/{id}/answer` | Последовательный ответ, проверка, объяснение, итог |
| POST `/notes`, PUT `/notes/{id}` | Заметки |
| POST `/tasks`, PATCH `/tasks/{id}` | Дедлайны с часовым поясом, выполнение |
| GET `/{collection}`, GET/DELETE `/{collection}/{id}` | Свои conversations, decks, quizzes, notes, tasks |

Учебный контекст: класс 1–13, предмет, тема, сложность, язык ru/en/de/uk. Материалы сохраняются в существующей таблице AIInteraction как JSON с типами COMPANION_*, активность — в StudySession. Новые миграции не требуются. Списки ограничены 100 последними записями; пагинации пока нет. Проверка краткого ответа сравнивает нормализованный термин/число, а не смысл произвольного текста.

Gemini: общий асинхронный клиент, отдельный system prompt, история, изображения, структурированный JSON и Pydantic-валидация. Ответы с ошибкой или обрывом не сохраняются. Повторяется один временно неудачный запрос; общий тайм-аут 90 секунд, до 4 одновременных обращений на процесс. Ограничение новых companion AI-запросов — 10 в минуту на пользователя и процесс.

## Поиск кабинета

`ROOM_FINDER_JAVA_URL` указывает на Java HTTP-мост. Python передаёт `/api/bridge` поля `location_id`, `duration_minutes`, `requested_by`. Java вызывает существующий TCP-протокол: 4-байтовая big-endian длина и JSON с `id`, `start_time`, `duration`, `corpus`. Ошибка моста не выдаётся за отсутствие свободных кабинетов. Реальный C++-сервер и оборудование в этой проверке не запускались. CAMERA_SERVICE_* — зарезервированные настройки, подключения к отдельному camera-service пока нет.

## Проверки

```sh
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=python_backend .venv/bin/python -m unittest discover -s python_backend/tests -v
RUN_DB_TESTS=1 PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=python_backend .venv/bin/python -m unittest discover -s python_backend/tests -v
```

Второй вариант требует подключённой тестовой БД. Создаёт временных пользователей и удаляет их данные в finally. AI в автотестах заменён контролируемыми ответами: тесты не тратят квоту Gemini и не включают камеры. Покрываются владение данными, refresh/auth, сохранение истории, карточки, результаты, параллельные ответы викторины и ошибки провайдера. OpenAPI: `/docs`; health: `/health`.
