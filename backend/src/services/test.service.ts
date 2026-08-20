import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/api-error.js';
import { testGenerationService } from './ai/test-generation.service.js';
import { achievementService } from './achievement.service.js';
import { MASTERY_LEVELS, XP_VALUES } from '../config/constants.js';
import type { Difficulty, QuestionType, MasteryLevel } from '@prisma/client';

export class TestService {
  async generateTest(params: {
    userId: string;
    subjectId: string;
    topic?: string;
    difficulty: Difficulty;
    questionCount: number;
    questionTypes: QuestionType[];
  }) {
    const generated = await testGenerationService.generate(params);

    // Find or create topic
    let topicId: string | undefined;
    const topicName = params.topic || 'Общее';
    
    const topic = await prisma.topic.upsert({
      where: { subjectId_name: { subjectId: params.subjectId, name: topicName } },
      create: { name: topicName, subjectId: params.subjectId },
      update: {},
    });
    topicId = topic.id;

    // Store test and questions in DB (correct answers stored ONLY on backend)
    const test = await prisma.test.create({
      data: {
        title: generated.title,
        subjectId: params.subjectId,
        topic: params.topic,
        difficulty: params.difficulty,
        questionCount: generated.questions.length,
        questionTypes: params.questionTypes,
        questions: {
          create: generated.questions.map((q, i) => ({
            type: q.type as QuestionType,
            question: q.question,
            options: q.options || [],
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            difficulty: q.difficulty as Difficulty,
            orderIndex: i,
            topicId,
          })),
        },
      },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    });

    // Return test WITHOUT correct answers (security)
    return {
      id: test.id,
      title: test.title,
      topic: test.topic,
      difficulty: test.difficulty,
      questionCount: test.questionCount,
      questions: test.questions.map(q => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        difficulty: q.difficulty,
        orderIndex: q.orderIndex,
        // NO correctAnswer or explanation!
      })),
    };
  }

  async getTest(testId: string, includeAnswers = false) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        questions: { orderBy: { orderIndex: 'asc' } },
        subject: { select: { id: true, name: true } },
      },
    });

    if (!test) throw ApiError.notFound('Test not found');

    return {
      ...test,
      questions: test.questions.map(q => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        difficulty: q.difficulty,
        orderIndex: q.orderIndex,
        ...(includeAnswers ? { correctAnswer: q.correctAnswer, explanation: q.explanation } : {}),
      })),
    };
  }

  async startAttempt(userId: string, testId: string) {
    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw ApiError.notFound('Test not found');

    // Check for existing in-progress attempt
    const existing = await prisma.attempt.findFirst({
      where: { userId, testId, status: 'IN_PROGRESS' },
    });

    if (existing) return existing;

    return prisma.attempt.create({
      data: { userId, testId },
    });
  }

  async saveProgress(attemptId: string, userId: string, progress: any) {
    const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.userId !== userId) throw ApiError.notFound('Attempt not found');
    if (attempt.status !== 'IN_PROGRESS') throw ApiError.badRequest('Attempt already completed');

    return prisma.attempt.update({
      where: { id: attemptId },
      data: { savedProgress: progress },
    });
  }

  async submitAttempt(
    attemptId: string,
    userId: string,
    answers: { questionId: string; userAnswer: any; timeSpent?: number }[],
    totalTime: number,
  ) {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          include: {
            questions: true,
            subject: true,
          },
        },
      },
    });

    if (!attempt || attempt.userId !== userId) throw ApiError.notFound('Attempt not found');
    if (attempt.status === 'COMPLETED') throw ApiError.badRequest('Attempt already submitted');

    // Grade answers on backend
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;

    const answerRecords = answers.map(a => {
      const question = attempt.test.questions.find(q => q.id === a.questionId);
      if (!question) return null;

      if (!a.userAnswer || (Array.isArray(a.userAnswer) && a.userAnswer.length === 0)) {
        skippedCount++;
        return {
          attemptId,
          questionId: a.questionId,
          userAnswer: a.userAnswer,
          isCorrect: false,
          timeSpent: a.timeSpent || null,
        };
      }

      const isCorrect = this.checkAnswer(a.userAnswer, question.correctAnswer);
      if (isCorrect) correctCount++;
      else wrongCount++;

      return {
        attemptId,
        questionId: a.questionId,
        userAnswer: a.userAnswer,
        isCorrect,
        timeSpent: a.timeSpent || null,
      };
    }).filter(Boolean) as any[];

    // Upsert answers
    for (const ans of answerRecords) {
      await prisma.answer.upsert({
        where: { attemptId_questionId: { attemptId: ans.attemptId, questionId: ans.questionId } },
        create: ans,
        update: { userAnswer: ans.userAnswer, isCorrect: ans.isCorrect, timeSpent: ans.timeSpent },
      });
    }

    const totalQuestions = attempt.test.questions.length;
    const percentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    // Update attempt
    const updatedAttempt = await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        status: 'COMPLETED',
        score: correctCount,
        percentage: Math.round(percentage * 100) / 100,
        correctCount,
        wrongCount,
        skippedCount,
        totalTime,
        completedAt: new Date(),
      },
      include: {
        test: { include: { subject: true } },
        answers: { include: { question: true } },
      },
    });

    // Update topic progress and mastery
    await this.updateProgress(userId, attempt.test, answerRecords);

    // Update XP and streak
    await this.updateGamification(userId, correctCount, percentage);

    // Record study session
    await prisma.studySession.create({
      data: {
        userId,
        subjectName: attempt.test.subject.name,
        topicName: attempt.test.topic,
        activityType: 'test',
        duration: totalTime,
        xpEarned: correctCount * XP_VALUES.CORRECT_ANSWER + XP_VALUES.TEST_COMPLETED +
          (percentage === 100 ? XP_VALUES.PERFECT_SCORE : 0),
      },
    });

    // Check and unlock achievements
    await achievementService.checkAchievements(userId);

    return updatedAttempt;
  }

  private checkAnswer(userAnswer: any, correctAnswer: any): boolean {
    const normalize = (v: any): string[] => {
      if (Array.isArray(v)) return v.map(x => String(x).trim().toLowerCase()).sort();
      return [String(v).trim().toLowerCase()];
    };

    const userNorm = normalize(userAnswer);
    const correctNorm = normalize(correctAnswer);

    if (userNorm.length !== correctNorm.length) return false;
    return userNorm.every((v, i) => v === correctNorm[i]);
  }

  private async updateProgress(userId: string, test: any, answers: any[]) {
    // Group answers by topic
    const topicResults = new Map<string, { correct: number; total: number }>();

    for (const ans of answers) {
      const question = test.questions.find((q: any) => q.id === ans.questionId);
      if (!question) continue;

      const topicId = question.topicId || 'general';
      const current = topicResults.get(topicId) || { correct: 0, total: 0 };
      current.total++;
      if (ans.isCorrect) current.correct++;
      topicResults.set(topicId, current);
    }

    for (const [topicId, results] of topicResults) {

      const existing = await prisma.topicProgress.findUnique({
        where: { userId_topicId: { userId, topicId } },
      });

      const totalAttempts = (existing?.totalAttempts || 0) + results.total;
      const correctAnswers = (existing?.correctAnswers || 0) + results.correct;
      const wrongAnswers = (existing?.wrongAnswers || 0) + (results.total - results.correct);
      const masteryScore = totalAttempts > 0 ? (correctAnswers / totalAttempts) * 100 : 0;
      const masteryLevel = this.getMasteryLevel(masteryScore);

      // Spaced repetition: update review interval
      const sessionScore = results.correct / results.total;
      let easeFactor = existing?.easeFactor || 2.5;
      let reviewInterval = existing?.reviewInterval || 1;

      if (sessionScore >= 0.8) {
        easeFactor = Math.max(1.3, easeFactor + 0.1);
        reviewInterval = Math.round(reviewInterval * easeFactor);
      } else if (sessionScore < 0.5) {
        easeFactor = Math.max(1.3, easeFactor - 0.2);
        reviewInterval = 1;
      }

      const nextReviewAt = new Date();
      nextReviewAt.setDate(nextReviewAt.getDate() + reviewInterval);

      await prisma.topicProgress.upsert({
        where: { userId_topicId: { userId, topicId } },
        create: {
          userId,
          topicId,
          masteryScore,
          masteryLevel,
          totalAttempts: results.total,
          correctAnswers: results.correct,
          wrongAnswers: results.total - results.correct,
          lastStudiedAt: new Date(),
          nextReviewAt,
          reviewInterval,
          easeFactor,
          currentDifficulty: test.difficulty,
        },
        update: {
          masteryScore,
          masteryLevel,
          totalAttempts,
          correctAnswers,
          wrongAnswers,
          lastStudiedAt: new Date(),
          nextReviewAt,
          reviewInterval,
          easeFactor,
        },
      });
    }
  }

  private getMasteryLevel(score: number): MasteryLevel {
    if (score >= 95) return 'MASTERED';
    if (score >= 80) return 'STRONG';
    if (score >= 60) return 'GOOD';
    if (score >= 30) return 'DEVELOPING';
    return 'BEGINNER';
  }

  private async updateGamification(userId: string, correctCount: number, percentage: number) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return;

    let xpEarned = XP_VALUES.TEST_COMPLETED + correctCount * XP_VALUES.CORRECT_ANSWER;
    if (percentage === 100) xpEarned += XP_VALUES.PERFECT_SCORE;

    // Update streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastStudy = profile.lastStudyDate ? new Date(profile.lastStudyDate) : null;
    lastStudy?.setHours(0, 0, 0, 0);

    let newStreak = profile.streak;
    if (!lastStudy || lastStudy.getTime() < today.getTime() - 86400000) {
      // Missed a day or first time
      newStreak = 1;
    } else if (lastStudy.getTime() < today.getTime()) {
      // Consecutive day
      newStreak = profile.streak + 1;
      xpEarned += XP_VALUES.STREAK_BONUS;
    }

    await prisma.studentProfile.update({
      where: { userId },
      data: {
        xp: { increment: xpEarned },
        streak: newStreak,
        bestStreak: Math.max(newStreak, profile.bestStreak),
        lastStudyDate: new Date(),
      },
    });
  }
}

export const testService = new TestService();
