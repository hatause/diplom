import { prisma } from '../../lib/prisma.js';
import { geminiService } from './gemini.service.js';
import { TUTOR_SYSTEM_PROMPT, RESULT_ANALYZER_SYSTEM_PROMPT, RECOMMENDATION_SYSTEM_PROMPT, EXPLANATION_SYSTEM_PROMPT } from './prompts.js';
import { logger } from '../../lib/logger.js';

export class TutorService {
  async chat(
    userId: string,
    message: string,
    options?: { subjectId?: string; topicId?: string; attemptId?: string; conversationHistory?: { role: string; content: string }[] },
  ): Promise<string> {
    // Build educational context
    let context = '';

    if (options?.subjectId) {
      const subject = await prisma.subject.findUnique({ where: { id: options.subjectId }, include: { topics: true } });
      if (subject) context += `Current subject: ${subject.name}\n`;
    }

    if (options?.topicId) {
      const topic = await prisma.topic.findUnique({ where: { id: options.topicId } });
      if (topic) context += `Current topic: ${topic.name}\n`;
    }

    // Get student progress summary
    const progress = await prisma.topicProgress.findMany({
      where: { userId },
      include: { topic: { include: { subject: true } } },
      orderBy: { masteryScore: 'asc' },
      take: 5,
    });

    if (progress.length > 0) {
      context += `\nStudent weak areas:\n`;
      progress.forEach(p => {
        context += `- ${p.topic.subject.name} → ${p.topic.name}: ${Math.round(p.masteryScore)}% mastery\n`;
      });
    }

    const messages = [
      ...(options?.conversationHistory || []),
      { role: 'user', content: context ? `[Context: ${context}]\n\n${message}` : message },
    ];

    const response = await geminiService.chat(TUTOR_SYSTEM_PROMPT, messages);

    // Log interaction
    await prisma.aIInteraction.create({
      data: {
        userId,
        type: 'tutor_chat',
        prompt: message.substring(0, 500),
        response: response.substring(0, 1000),
        model: 'gemini',
        subjectName: options?.subjectId || undefined,
      },
    });

    return response;
  }
}

export class ResultAnalysisService {
  async analyze(userId: string, attemptId: string): Promise<any> {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        test: { include: { subject: true } },
        answers: {
          include: { question: { include: { topic: true } } },
        },
      },
    });

    if (!attempt) throw new Error('Attempt not found');

    const wrongAnswers = attempt.answers.filter(a => !a.isCorrect);
    const correctAnswers = attempt.answers.filter(a => a.isCorrect);

    const prompt = `Analyze this test result:
- Subject: ${attempt.test.subject.name}
- Topic: ${attempt.test.topic || 'General'}
- Score: ${attempt.percentage}%
- Correct: ${attempt.correctCount}/${attempt.answers.length}
- Difficulty: ${attempt.test.difficulty}

Wrong answers by topic:
${wrongAnswers.map(a => `- ${a.question.topic?.name || 'General'}: "${a.question.question}" (answered: ${JSON.stringify(a.userAnswer)}, correct: ${JSON.stringify(a.question.correctAnswer)})`).join('\n')}

Correct answers by topic:
${correctAnswers.map(a => `- ${a.question.topic?.name || 'General'}: "${a.question.question}"`).join('\n')}`;

    const analysis = await geminiService.generateJSON(RESULT_ANALYZER_SYSTEM_PROMPT, prompt);

    // Save analysis to attempt
    await prisma.attempt.update({
      where: { id: attemptId },
      data: { aiAnalysis: analysis as any },
    });

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: 'result_analysis',
        prompt: prompt.substring(0, 500),
        response: JSON.stringify(analysis).substring(0, 1000),
        model: 'gemini',
        subjectName: attempt.test.subject.name,
      },
    });

    return analysis;
  }
}

export class RecommendationService {
  async getRecommendations(userId: string): Promise<any> {
    const progress = await prisma.topicProgress.findMany({
      where: { userId },
      include: { topic: { include: { subject: true } } },
      orderBy: { masteryScore: 'asc' },
    });

    const recentAttempts = await prisma.attempt.findMany({
      where: { userId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: 5,
      include: { test: { include: { subject: true } } },
    });

    const prompt = `Based on this student's performance, suggest what to study:

Topic progress (weakest first):
${progress.slice(0, 10).map(p => `- ${p.topic.subject.name} → ${p.topic.name}: ${Math.round(p.masteryScore)}% (last: ${p.lastStudiedAt?.toISOString().split('T')[0] || 'never'})`).join('\n')}

Recent tests:
${recentAttempts.map(a => `- ${a.test.subject.name}: ${a.percentage}% (${a.test.difficulty})`).join('\n')}`;

    return geminiService.generateJSON(RECOMMENDATION_SYSTEM_PROMPT, prompt);
  }
}

export class ExplanationService {
  async explain(userId: string, questionId: string, attemptId: string): Promise<string> {
    const answer = await prisma.answer.findFirst({
      where: { questionId, attemptId },
      include: { question: { include: { topic: true } } },
    });

    if (!answer) throw new Error('Answer not found');

    const prompt = `Question: ${answer.question.question}
Student's answer: ${JSON.stringify(answer.userAnswer)}
Correct answer: ${JSON.stringify(answer.question.correctAnswer)}
Original explanation: ${answer.question.explanation || 'None provided'}
Topic: ${answer.question.topic?.name || 'General'}`;

    return geminiService.generateText(EXPLANATION_SYSTEM_PROMPT, prompt);
  }
}

export const tutorService = new TutorService();
export const resultAnalysisService = new ResultAnalysisService();
export const recommendationService = new RecommendationService();
export const explanationService = new ExplanationService();
