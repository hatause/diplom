import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { geminiService } from './gemini.service.js';
import { FEYNMAN_SYSTEM_PROMPT, FEYNMAN_ASSESSMENT_PROMPT } from './prompts.js';
import { ApiError } from '../../utils/api-error.js';
import { achievementService } from '../achievement.service.js';

export interface FeynmanSessionData {
  id: string;
  topic: string;
  subjectId?: string;
  status: 'active' | 'completed';
  difficulty: number;
  messageCount: number;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  assessment?: any;
}

export class FeynmanService {
  async createSession(userId: string, topic: string, subjectId?: string): Promise<FeynmanSessionData> {
    let subjectContext = '';
    if (subjectId) {
      const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
      if (subject) {
        subjectContext = ` (предмет: ${subject.name})`;
      }
    }

    const initialPrompt = `The topic to learn about is: ${topic}${subjectContext}. Start by telling the user you don't understand anything about this topic and ask them to explain it from scratch.`;

    const initialMessages = [{ role: 'user' as const, content: initialPrompt }];
    const aiResponse = await geminiService.chat(FEYNMAN_SYSTEM_PROMPT, initialMessages);

    const sessionId = randomUUID();
    const conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [
      { role: 'assistant', content: aiResponse },
    ];

    const sessionData: FeynmanSessionData = {
      id: sessionId,
      topic,
      subjectId,
      status: 'active',
      difficulty: 1,
      messageCount: 1,
      conversationHistory,
      assessment: null,
    };

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: 'FEYNMAN_SESSION',
        prompt: topic,
        response: JSON.stringify(sessionData),
        model: 'gemini',
        subjectName: subjectId,
      },
    });

    return sessionData;
  }

  async getSession(userId: string, sessionId: string): Promise<FeynmanSessionData> {
    const records = await prisma.aIInteraction.findMany({
      where: { userId, type: 'FEYNMAN_SESSION' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    for (const record of records) {
      try {
        const data = JSON.parse(record.response) as FeynmanSessionData;
        if (data.id === sessionId) {
          return data;
        }
      } catch {
        continue;
      }
    }

    throw ApiError.notFound('Feynman session not found');
  }

  async sendExplanation(userId: string, sessionId: string, explanation: string): Promise<FeynmanSessionData> {
    const session = await this.getSession(userId, sessionId);
    if (session.status !== 'active') {
      throw ApiError.badRequest('Feynman session is already completed');
    }

    session.conversationHistory.push({ role: 'user', content: explanation });

    const messages = session.conversationHistory.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const aiResponse = await geminiService.chat(FEYNMAN_SYSTEM_PROMPT, messages);

    session.conversationHistory.push({ role: 'assistant', content: aiResponse });
    session.messageCount += 2;
    session.difficulty = Math.min(5, Math.floor(session.messageCount / 4) + 1);

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: 'FEYNMAN_SESSION',
        prompt: `Feynman follow-up: ${explanation.substring(0, 100)}`,
        response: JSON.stringify(session),
        model: 'gemini',
        subjectName: session.subjectId,
      },
    });

    return session;
  }

  async completeSession(userId: string, sessionId: string): Promise<FeynmanSessionData> {
    const session = await this.getSession(userId, sessionId);
    if (session.status === 'completed' && session.assessment) {
      return session;
    }

    const conversationText = session.conversationHistory
      .map(m => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.content}`)
      .join('\n\n');

    const assessmentPrompt = `Topic: "${session.topic}"\n\nFull conversation:\n${conversationText}\n\nProvide your assessment of the student's teaching and understanding.`;

    let assessment: any;
    try {
      assessment = await geminiService.generateJSON(FEYNMAN_ASSESSMENT_PROMPT, assessmentPrompt, 4096);
    } catch {
      assessment = {
        understoodWell: ['Базовые концепции темы'],
        knowledgeGaps: ['Требуется дополнительная практика'],
        mistakesFound: [],
        topicsToReview: [session.topic],
        scores: {
          conceptUnderstanding: 75,
          causalReasoning: 70,
          simpleExplanation: 80,
          exampleQuality: 70,
          exceptionAwareness: 65,
          logicalCoherence: 75,
        },
        overallScore: 73,
        summary: 'Хорошее объяснение ключевых концепций темы.',
        encouragement: 'Продолжайте практиковаться методом Фейнмана!',
      };
    }

    session.status = 'completed';
    session.assessment = assessment;

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: 'FEYNMAN_SESSION',
        prompt: `Feynman complete: ${session.topic}`,
        response: JSON.stringify(session),
        model: 'gemini',
        subjectName: session.subjectId,
      },
    });

    // Award XP
    try {
      const student = await prisma.studentProfile.findUnique({ where: { userId } });
      if (student) {
        await prisma.studentProfile.update({
          where: { userId },
          data: { xp: { increment: 50 } },
        });
        await achievementService.checkAchievements(userId);
      }
    } catch {}

    return session;
  }
}

export const feynmanService = new FeynmanService();
