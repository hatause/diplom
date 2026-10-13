# Python backend Aituto

Единственный backend приложения — FastAPI + Prisma Python + PostgreSQL. React обращается к `/api/v1` через Vite proxy на порт 4000. Оба корневых Docker Compose собирают `python_backend/Dockerfile`; сервис `backend` — это Python. Старый Node.js-сервер удалён. Прямые зависимости закреплены на версиях из проверенного локального Python-окружения.

Для локального API сначала запустите Docker Desktop и PostgreSQL проекта:

```sh
docker compose up -d postgres
```

Локальный `DATABASE_URL` в `.env` и `python_backend/.env` должен указывать на `postgresql://aitutor:aitutor_secret@localhost:5433/aitutor?schema=public`, как в `.env.example`. Порт 5432 может принадлежать базе другого проекта. В контейнере Compose самостоятельно задаёт адрес `postgres:5432`.

Из корня проекта, после установки зависимостей и генерации Prisma-клиента:

```sh
python3 -m venv .venv
.venv/bin/pip install -r python_backend/requirements.txt
.venv/bin/prisma generate --schema python_backend/schema.prisma
.venv/bin/python -m uvicorn app.main:app --app-dir python_backend --host 127.0.0.1 --port 4000
```

В другом терминале запустите сайт: `cd frontend && npm run dev`. Проверка API: `curl http://127.0.0.1:4000/health`. Если запущен только Vite, запросы `/api` могут возвращать 500 из-за недоступного API.

Требуется существующая PostgreSQL с таблицами из `python_backend/schema.prisma`. Запуск сервера не удаляет, не заполняет и не меняет схему базы автоматически.

Для новой базы можно явно создать таблицы и заполнить каталог достижений:

```sh
.venv/bin/prisma db push --schema python_backend/schema.prisma
.venv/bin/python python_backend/scripts/seed.py
# Необязательно: добавить прежние демонстрационные группы, пользователей,
# предметы, темы и расписание. Пароль новых демо-аккаунтов — password123.
.venv/bin/python python_backend/scripts/seed.py --demo
```

`seed.py` перенесён из Node.js на Python. Повторный последовательный запуск не дублирует данные и не сбрасывает существующие пароли. Схема таблиц совпадает с прежней; перенос данных для замены сервера не требуется.

Настройки в `python_backend/.env`: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL` (по умолчанию `gemini-2.5-flash`), `SCHOOL_TIMEZONE` (Asia/Almaty), `CORS_ORIGIN` (список через запятую), `AI_TIMEOUT_SECONDS` (90). В production задайте собственные секреты, `NODE_ENV=production` и HTTPS. Ключ Gemini используется только сервером и передаётся в заголовке запроса.

Загрузки всегда сохраняются в `python_backend/uploads`, независимо от текущей рабочей директории. Docker подключает эту папку к `/app/uploads`, поэтому файлы переживают пересборку контейнера. При переносе старые локальные настройки сохранены в игнорируемом `.env.legacy`, настройки прежнего контейнера — в `.env.docker-legacy`; приложение и Docker их не загружают.

## Docker

Из корня проекта, Docker Compose 2.24+:

```sh
cp .env.example .env # только при первой настройке; заполните значения
docker compose build
docker compose up -d postgres
# Только если нужно инициализировать новую базу:
docker compose run --rm backend prisma db push --schema schema.prisma --skip-generate
docker compose run --rm backend python scripts/seed.py
docker compose up -d
```

Сайт: `http://localhost:5173`, API: `http://localhost:4000/api/v1`. Vite в контейнере использует `BACKEND_URL=http://backend:4000`; локальный Vite — `http://127.0.0.1:4000`. Используйте один способ запуска на этих портах: локальные процессы или Compose.

Production: `docker compose -f docker-compose.prod.yml up -d --build`. Предварительная инициализация новой базы выполняется теми же командами `run` с `-f docker-compose.prod.yml`. Настройте `CORS_ORIGIN` под домен сайта; TLS завершается на вашем HTTPS-прокси. Имя Compose-проекта закреплено как `aitutor`, поэтому сохраняется прежний том `aitutor_postgres-data` даже после переименования папки проекта. Docker получает настройки из корневого `.env` и затем из `python_backend/.env`, если он есть; адрес контейнерной базы и режим запуска задаёт Compose. На Linux папка загрузок должна быть доступна для записи UID 1001.

Prisma CLI использует Node как внутреннюю утилиту генерации клиента. HTTP-сервер запускается только через Python/uvicorn; Fastify и npm-пакет старого сервера отсутствуют.

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

В Docker адрес задаётся отдельной переменной `ROOM_FINDER_JAVA_URL_DOCKER` в корневом `.env` (по умолчанию `http://host.docker.internal:3333`, Java на хосте). Это позволяет локальному Python продолжать использовать `127.0.0.1`. Расписание занятий Python читает из PostgreSQL; параметры старых Node-провайдеров `SCHEDULE_PROVIDER_*` больше не используются.

## Проверки

```sh
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=python_backend .venv/bin/python -m unittest discover -s python_backend/tests -v
RUN_DB_TESTS=1 PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=python_backend .venv/bin/python -m unittest discover -s python_backend/tests -v
```

Второй вариант требует подключённой тестовой БД. Создаёт временных пользователей и удаляет их данные в finally. AI в автотестах заменён контролируемыми ответами: тесты не тратят квоту Gemini и не включают камеры. Покрываются владение данными, refresh/auth, сохранение истории, карточки, результаты, параллельные ответы викторины и ошибки провайдера. OpenAPI: `/docs`; health: `/health`.


## Прикреплённые лекции

Объяснение и генерация теста используют текст лекции **и вложение**. PDF и изображения JPEG/PNG/WebP передаются в Gemini; из DOCX, PPTX, TXT/MD/CSV извлекается текст. PPTX определяется по содержимому, даже если файл назван `.ppt`. Старые бинарные PPT нужно предварительно сохранить как PPTX или PDF. Для презентаций, где важны рисунки или сканы, используйте PDF: из PPTX извлекаются текстовые блоки слайдов.

Кнопка «Извлечь текст из файла» возвращает текст документа, а для PDF/изображений запускает распознавание через Gemini. Исходный файл и текст лекции не перезаписываются. Файлы ограничены 12 МБ, извлечённый текст — 120 000 символов; слишком большие, пустые, повреждённые или неподдерживаемые файлы дают понятную ошибку. Для проверки цепочки загрузки, объяснения и тестирования: `RUN_DB_TESTS=1 PYTHONPATH=python_backend .venv/bin/python -m unittest discover -s python_backend/tests -p test_lectures.py`.
