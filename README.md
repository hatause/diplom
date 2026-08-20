# AI Tutor 🎓

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-Fastify-339933.svg?logo=node.js)
![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED.svg?logo=docker)

**AI Tutor** — это современная, production-ready веб-платформа для обучения студентов с использованием искусственного интеллекта. Платформа предлагает автоматизированную генерацию тестов, персонализированные рекомендации по обучению, встроенного AI-ассистента и продвинутую систему геймификации.

## 🌟 Ключевые возможности

### 👨‍🎓 Для студентов
- **Умные тесты**: Прохождение тестов, сгенерированных AI под ваш уровень знаний (поддержка вопросов с одним/множественным выбором, верно/неверно, кратким ответом).
- **AI-Тьютор**: Встроенный чат с ИИ-помощником, который знает контекст ваших предметов и помогает разобраться в сложных темах.
- **Геймификация**: Получение опыта (XP), система уровней, стрик (серия дней) и достижения за успехи в учебе.
- **Интервальное повторение (Spaced Repetition)**: Умные напоминания и подбор тем для повторения, чтобы знания усваивались лучше.
- **Аналитика**: Детальная статистика успеваемости, анализ сильных и слабых сторон.

### 👨‍🏫 Для преподавателей
- **Управление курсами**: Создание и редактирование предметов, тем и лекций.
- **Генерация тестов в 1 клик**: Использование Gemini AI для мгновенного создания тестов на основе материалов лекции.
- **Контроль успеваемости**: Просмотр аналитики по каждому студенту и группе в целом.

### 🛠 Для администраторов
- **Управление пользователями**: Полный контроль над аккаунтами студентов и преподавателей.
- **Системная аналитика**: Мониторинг использования AI, нагрузки на платформу и общей активности.

## 🚀 Технологический стек

### Frontend
- **Ядро**: React 19, TypeScript, Vite
- **Стилизация**: TailwindCSS v4, Framer Motion (анимации), "Liquid Glass" дизайн (Glassmorphism)
- **Управление состоянием**: Zustand
- **Маршрутизация**: React Router v7
- **UI-компоненты**: Radix UI, Lucide React, Recharts (графики)

### Backend
- **Ядро**: Node.js, Fastify, TypeScript
- **База данных**: PostgreSQL 16 + Prisma ORM
- **Валидация**: Zod
- **AI Интеграция**: Google Gemini API (`@google/genai`)
- **Документация API**: Swagger / OpenAPI (встроенный в Fastify)

### Инфраструктура
- **Контейнеризация**: Docker, Docker Compose
- **Веб-сервер / Proxy**: Nginx (Rate limiting, Security headers)

## 📁 Архитектура проекта

Проект разделен на логические модули (монорепозиторий):

```text
.
├── backend/                # REST API сервер на Fastify
│   ├── prisma/             # Схема БД и скрипты миграций/сидирования
│   ├── src/
│   │   ├── routes/         # Контроллеры и маршруты API
│   │   ├── schemas/        # Zod-схемы для валидации запросов
│   │   ├── services/       # Бизнес-логика (AI генерация, тесты, расписание и др.)
│   │   ├── plugins/        # Плагины Fastify (Auth, Swagger и др.)
│   │   └── lib/            # Утилиты (Logger, Prisma client)
│   └── Dockerfile          # Спецификация сборки бэкенда
├── frontend/               # SPA приложение на React + Vite
│   ├── src/
│   │   ├── api/            # Axios HTTP клиент с интерцепторами токенов
│   │   ├── layouts/        # Основные слои (MainLayout, AuthLayout)
│   │   ├── pages/          # Экраны приложения (Dashboard, TestPlayer, AI Tutor...)
│   │   ├── store/          # Zustand сторы
│   │   └── styles/         # CSS стили и Tailwind конфигурация
│   └── Dockerfile          # Спецификация сборки фронтенда
├── mock-schedule-server/   # Мок-сервер TCP для тестирования провайдеров расписания
├── nginx/                  # Конфигурация Nginx как reverse-proxy
└── docker-compose.yml      # Конфигурация для быстрого запуска всего стека
```

## ⚙️ Инструкция по запуску

### Запуск через Docker (Рекомендуемый способ)

1. **Клонируйте репозиторий**:
   ```bash
   git clone https://github.com/hatause/diplom.git
   cd diplom
   ```

2. **Настройте переменные окружения**:
   Скопируйте пример файла конфигурации и укажите ваш ключ от Google Gemini API.
   ```bash
   cp .env.example .env
   # Откройте .env в любом редакторе и вставьте ваш GEMINI_API_KEY
   ```

3. **Запустите контейнеры**:
   ```bash
   docker-compose up -d --build
   ```

4. **Инициализируйте базу данных**:
   Примените миграции и наполните БД тестовыми данными.
   ```bash
   docker-compose exec backend npx prisma migrate deploy
   docker-compose exec backend npm run prisma:seed
   ```

5. **Откройте платформу**:
   - Frontend приложение: [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:4000/api/v1](http://localhost:4000/api/v1)
   - Swagger Документация: [http://localhost:4000/documentation](http://localhost:4000/documentation)

### Локальный запуск (Development режим без Docker)

**1. Настройка базы данных**
Убедитесь, что у вас запущен локальный PostgreSQL.

**2. Запуск Backend**
```bash
cd backend
npm install
# Создайте файл .env внутри папки backend и укажите DATABASE_URL и GEMINI_API_KEY
npx prisma db push
npm run prisma:seed
npm run dev
```

**3. Запуск Frontend**
В новом окне терминала:
```bash
cd frontend
npm install
npm run dev
```

## 🧪 Тестирование

На бэкенде настроены тесты с использованием `Vitest`. Запустить их можно командой:
```bash
cd backend
npm run test
```

## 🔐 Учетные данные для тестирования (из seed-скрипта)

После выполнения сидирования базы данных (`prisma:seed`), вы можете использовать следующие аккаунты для входа:

| Роль | Email | Пароль |
| :--- | :--- | :--- |
| **Студент** | `student@aitutor.com` | `password123` |
| **Преподаватель** | `teacher@aitutor.com` | `password123` |
| **Администратор** | `admin@aitutor.com` | `password123` |
