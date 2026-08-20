import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Groups ──
  const groups = await Promise.all([
    prisma.group.upsert({ where: { code: 'CS-101' }, create: { name: 'Информатика 1 курс', code: 'CS-101' }, update: {} }),
    prisma.group.upsert({ where: { code: 'CS-201' }, create: { name: 'Информатика 2 курс', code: 'CS-201' }, update: {} }),
    prisma.group.upsert({ where: { code: 'MATH-101' }, create: { name: 'Математика 1 курс', code: 'MATH-101' }, update: {} }),
  ]);

  // ── Users ──
  const passwordHash = await bcrypt.hash('password123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@aitutor.com' },
    create: {
      email: 'admin@aitutor.com', passwordHash, firstName: 'Админ', lastName: 'Системный', role: 'ADMIN',
    },
    update: {},
  });

  const teacher1 = await prisma.user.upsert({
    where: { email: 'petrov@aitutor.com' },
    create: {
      email: 'petrov@aitutor.com', passwordHash, firstName: 'Пётр', lastName: 'Петров', role: 'TEACHER',
    },
    update: {},
  });

  const teacher2 = await prisma.user.upsert({
    where: { email: 'sidorova@aitutor.com' },
    create: {
      email: 'sidorova@aitutor.com', passwordHash, firstName: 'Елена', lastName: 'Сидорова', role: 'TEACHER',
    },
    update: {},
  });

  const student1 = await prisma.user.upsert({
    where: { email: 'student@aitutor.com' },
    create: {
      email: 'student@aitutor.com', passwordHash, firstName: 'Иван', lastName: 'Иванов', role: 'STUDENT',
      studentProfile: { create: { groupId: groups[0].id, xp: 250, streak: 3, bestStreak: 7 } },
    },
    update: {},
  });

  const student2 = await prisma.user.upsert({
    where: { email: 'maria@aitutor.com' },
    create: {
      email: 'maria@aitutor.com', passwordHash, firstName: 'Мария', lastName: 'Козлова', role: 'STUDENT',
      studentProfile: { create: { groupId: groups[0].id, xp: 180, streak: 1, bestStreak: 5 } },
    },
    update: {},
  });

  // ── Subjects ──
  const subjects = await Promise.all([
    prisma.subject.upsert({
      where: { code: 'MATH_ANALYSIS' },
      create: {
        name: 'Математический анализ', code: 'MATH_ANALYSIS',
        description: 'Пределы, производные, интегралы, ряды',
        teacherId: teacher1.id, color: '#10B981', iconName: 'Calculator',
      },
      update: {},
    }),
    prisma.subject.upsert({
      where: { code: 'LINEAR_ALGEBRA' },
      create: {
        name: 'Линейная алгебра', code: 'LINEAR_ALGEBRA',
        description: 'Матрицы, определители, системы уравнений, векторные пространства',
        teacherId: teacher1.id, color: '#6366F1', iconName: 'Grid3x3',
      },
      update: {},
    }),
    prisma.subject.upsert({
      where: { code: 'PROGRAMMING' },
      create: {
        name: 'Программирование', code: 'PROGRAMMING',
        description: 'Основы алгоритмов, структуры данных, ООП',
        teacherId: teacher2.id, color: '#F59E0B', iconName: 'Code',
      },
      update: {},
    }),
    prisma.subject.upsert({
      where: { code: 'PHYSICS' },
      create: {
        name: 'Физика', code: 'PHYSICS',
        description: 'Механика, термодинамика, электричество',
        teacherId: teacher2.id, color: '#EF4444', iconName: 'Atom',
      },
      update: {},
    }),
    prisma.subject.upsert({
      where: { code: 'DISCRETE_MATH' },
      create: {
        name: 'Дискретная математика', code: 'DISCRETE_MATH',
        description: 'Логика, комбинаторика, графы, автоматы',
        teacherId: teacher1.id, color: '#8B5CF6', iconName: 'Shapes',
      },
      update: {},
    }),
  ]);

  // ── Topics ──
  const topicData: { subjectIdx: number; topics: string[] }[] = [
    { subjectIdx: 0, topics: ['Пределы', 'Производные', 'Интегралы', 'Ряды', 'Дифференциальные уравнения'] },
    { subjectIdx: 1, topics: ['Матрицы', 'Определители', 'Системы линейных уравнений', 'Векторные пространства', 'Линейные преобразования'] },
    { subjectIdx: 2, topics: ['Алгоритмы', 'Структуры данных', 'ООП', 'Паттерны проектирования', 'Базы данных'] },
    { subjectIdx: 3, topics: ['Механика', 'Термодинамика', 'Электричество', 'Оптика', 'Квантовая физика'] },
    { subjectIdx: 4, topics: ['Математическая логика', 'Комбинаторика', 'Теория графов', 'Автоматы', 'Теория множеств'] },
  ];

  for (const td of topicData) {
    for (let i = 0; i < td.topics.length; i++) {
      await prisma.topic.upsert({
        where: { subjectId_name: { subjectId: subjects[td.subjectIdx].id, name: td.topics[i] } },
        create: { name: td.topics[i], subjectId: subjects[td.subjectIdx].id, orderIndex: i },
        update: {},
      });
    }
  }

  // ── Schedule ──
  const scheduleData = [
    { subjectIdx: 0, groupIdx: 0, day: 1, start: '09:00', end: '10:30', room: 'А-301' },
    { subjectIdx: 2, groupIdx: 0, day: 1, start: '10:45', end: '12:15', room: 'Б-215' },
    { subjectIdx: 1, groupIdx: 0, day: 2, start: '09:00', end: '10:30', room: 'А-301' },
    { subjectIdx: 3, groupIdx: 0, day: 2, start: '10:45', end: '12:15', room: 'В-102' },
    { subjectIdx: 4, groupIdx: 0, day: 3, start: '09:00', end: '10:30', room: 'А-205' },
    { subjectIdx: 0, groupIdx: 0, day: 3, start: '10:45', end: '12:15', room: 'А-301' },
    { subjectIdx: 2, groupIdx: 0, day: 4, start: '09:00', end: '10:30', room: 'Б-215' },
    { subjectIdx: 1, groupIdx: 0, day: 4, start: '13:00', end: '14:30', room: 'А-301' },
    { subjectIdx: 3, groupIdx: 0, day: 5, start: '09:00', end: '10:30', room: 'В-102' },
    { subjectIdx: 4, groupIdx: 0, day: 5, start: '10:45', end: '12:15', room: 'А-205' },
  ];

  for (const item of scheduleData) {
    const subject = subjects[item.subjectIdx];
    const teacher = await prisma.user.findUnique({ where: { id: subject.teacherId! } });
    await prisma.scheduleItem.create({
      data: {
        subjectId: subject.id,
        groupId: groups[item.groupIdx].id,
        teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
        room: item.room,
        dayOfWeek: item.day,
        startTime: item.start,
        endTime: item.end,
      },
    });
  }

  // ── Achievements ──
  const achievements = [
    { code: 'FIRST_TEST', name: 'Первый тест', description: 'Пройдите ваш первый тест', iconName: 'Trophy', xpReward: 50, condition: { type: 'test_count', value: 1 } },
    { code: 'TEN_TESTS', name: '10 тестов', description: 'Пройдите 10 тестов', iconName: 'Award', xpReward: 100, condition: { type: 'test_count', value: 10 } },
    { code: 'HUNDRED_QUESTIONS', name: '100 вопросов', description: 'Ответьте на 100 вопросов', iconName: 'HelpCircle', xpReward: 150, condition: { type: 'question_count', value: 100 } },
    { code: 'PERFECT_SCORE', name: 'Идеально!', description: 'Получите 100% на тесте', iconName: 'Star', xpReward: 100, condition: { type: 'perfect_score', value: 1 } },
    { code: 'WEEK_STREAK', name: 'Недельная серия', description: '7 дней подряд обучения', iconName: 'Flame', xpReward: 200, condition: { type: 'streak', value: 7 } },
    { code: 'MASTERED_TOPIC', name: 'Мастер темы', description: 'Достигните уровня Mastered по любой теме', iconName: 'GraduationCap', xpReward: 300, condition: { type: 'mastery', value: 95 } },
    { code: 'NIGHT_OWL', name: 'Сова', description: 'Пройдите тест после 23:00', iconName: 'Moon', xpReward: 50, condition: { type: 'night_test', value: 1 } },
    { code: 'SPEED_DEMON', name: 'Скоростной', description: 'Пройдите тест менее чем за 2 минуты', iconName: 'Zap', xpReward: 75, condition: { type: 'speed', value: 120 } },
  ];

  for (const ach of achievements) {
    await prisma.achievement.upsert({
      where: { code: ach.code },
      create: ach,
      update: {},
    });
  }

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Demo accounts:');
  console.log('  Student: student@aitutor.com / password123');
  console.log('  Teacher: petrov@aitutor.com / password123');
  console.log('  Admin:   admin@aitutor.com / password123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
