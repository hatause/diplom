# AI Tutor 🎓

AI Tutor — это современная, полноценная production-ready веб-платформа для обучения студентов с AI-генерацией тестов, персональными рекомендациями и геймификацией. Проект создан с нуля с использованием передовых технологий.

## Технологический стек

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS v4, Framer Motion, Zustand, React Router, Recharts, Lucide React.
- **Backend**: Node.js, Fastify, TypeScript, Prisma ORM, Zod, Pino (для логов).
- **База данных**: PostgreSQL 16.
- **AI Интеграция**: Google Gemini API (@google/genai).
- **Инфраструктура**: Docker, Docker Compose, Nginx (Rate limiting, Security headers).

## Особенности проекта

1. **AI-Генерация тестов**: Создание персонализированных тестов (один выбор, множественный, верно/неверно, краткий ответ) с учетом предмета, темы и сложности.
2. **AI Тьютор**: Встроенный чат с ИИ-помощником, который имеет контекст изучаемых предметов и помогает студентам разбираться с трудными темами.
3. **AI Аналитика**: Детальный анализ результатов тестов с выявлением сильных/слабых сторон и формированием персонального плана обучения.
4. **Интеграция расписания**: Поддержка множественных провайдеров для синхронизации расписания (HTTP REST, TCP Socket, Push Webhook, Database direct access) с использованием паттернов Factory и Strategy.
5. **Геймификация и интервальное повторение**: Начисление XP, поддержка серии дней, достижения, а также алгоритм, предлагающий темы для повторения (Spaced Repetition).
6. **Дизайн "Liquid Glass"**: Современный, премиальный интерфейс в стиле Glassmorphism с поддержкой светлой и тёмной темы, микроанимациями и плавными переходами.

## Структура проекта

```text
.
├── backend/                # Fastify REST API сервер
│   ├── prisma/             # Схема БД и миграции
│   ├── src/
│   │   ├── routes/         # API эндпоинты
│   │   ├── schemas/        # Zod схемы валидации
│   │   ├── services/       # Бизнес-логика (AI, Schedule, Test, и т.д.)
│   │   └── utils/          # Утилиты и логгер
│   └── Dockerfile          # Dockerfile бэкенда
├── frontend/               # React Vite приложение
│   ├── src/
│   │   ├── api/            # Axios клиент с интерцепторами
│   │   ├── layouts/        # Основные шаблоны (MainLayout, AuthLayout)
│   │   ├── pages/          # Все страницы платформы
│   │   ├── store/          # Zustand сторы (auth, theme)
│   │   └── styles/         # Глобальные стили (Glassmorphism, Tailwind)
│   └── Dockerfile          # Dockerfile фронтенда
├── mock-schedule-server/   # Моковый сервер для тестирования TCP провайдера расписания
├── nginx/                  # Конфигурация Nginx как API шлюза
└── docker-compose.yml      # Docker-compose для dev-среды
```

## Инструкция по запуску (Docker)

1. Клонируйте репозиторий и перейдите в корень:
   ```bash
   cd "new project"
   ```

2. Настройте переменные окружения:
   Скопируйте `.env.example` в `.env` и обязательно укажите свой `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env
   # Отредактируйте .env
   ```

3. Запустите проект через Docker Compose:
   ```bash
   docker-compose up -d --build
   ```

4. Выполните миграции БД и инициализацию (сидирование):
   ```bash
   docker-compose exec backend npx prisma migrate deploy
   docker-compose exec backend npm run seed
   ```

5. Платформа будет доступна:
   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:4000/api/v1](http://localhost:4000/api/v1)

## Локальный запуск (без Docker)

### Backend
```bash
cd backend
npm install
# В .env (в корне backend) задайте DATABASE_URL и GEMINI_API_KEY
npx prisma db push
npm run seed
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Учетные данные для тестирования (из seed)
- **Студент**: `student@aitutor.com` / `password123`
- **Преподаватель**: `teacher@aitutor.com` / `password123`
- **Администратор**: `admin@aitutor.com` / `password123`
