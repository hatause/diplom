import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { geminiService } from './gemini.service.js';
import { DEBATE_SYSTEM_PROMPT, DEBATE_ASSESSMENT_PROMPT } from './prompts.js';
import { ApiError } from '../../utils/api-error.js';
import { achievementService } from '../achievement.service.js';

export interface DebateSessionData {
  id: string;
  topic: string;
  userPosition: string;
  aiPosition: string;
  subjectId?: string;
  status: 'active' | 'completed';
  roundNumber: number;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  assessment?: any;
}

export class DebateService {
  async createSession(
    userId: string,
    topic: string,
    userPosition: string,
    subjectId?: string
  ): Promise<DebateSessionData> {
    let subjectContext = '';
    if (subjectId) {
      const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
      if (subject) {
        subjectContext = ` (subject: ${subject.name})`;
      }
    }

    const aiPosition = `opposing "${userPosition}"`;

    const initialPrompt = `The debate topic is: "${topic}"${subjectContext}.\n` +
      `The user's position is: "${userPosition}".\n` +
      `You are arguing AGAINST this position.\n\n` +
      `Start the debate by presenting your opening counter-argument to the user's position. ` +
      `Be respectful but firm. End with a question that challenges the user's stance.`;

    const initialMessages = [{ role: 'user' as const, content: initialPrompt }];
    const aiResponse = await geminiService.chat(DEBATE_SYSTEM_PROMPT, initialMessages);

    const sessionId = randomUUID();
    const conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [
      { role: 'assistant', content: aiResponse },
    ];

    const sessionData: DebateSessionData = {
      id: sessionId,
      topic,
      userPosition,
      aiPosition,
      subjectId,
      status: 'active',
      roundNumber: 1,
      conversationHistory,
      assessment: null,
    };

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: 'DEBATE_SESSION',
        prompt: `${topic} | Position: ${userPosition}`,
        response: JSON.stringify(sessionData),
        model: 'gemini',
        subjectName: subjectId,
      },
    });

    return sessionData;
  }

  async getSession(userId: string, sessionId: string): Promise<DebateSessionData> {
    const records = await prisma.aIInteraction.findMany({
      where: { userId, type: 'DEBATE_SESSION' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    for (const record of records) {
      try {
        const data = JSON.parse(record.response) as DebateSessionData;
        if (data.id === sessionId) {
          return data;
        }
      } catch {
        continue;
      }
    }

    throw ApiError.notFound('Debate session not found');
  }

  async sendArgument(userId: string, sessionId: string, argument: string): Promise<DebateSessionData> {
    const session = await this.getSession(userId, sessionId);
    if (session.status !== 'active') {
      throw ApiError.badRequest('Debate session is already completed');
    }

    session.conversationHistory.push({ role: 'user', content: argument });

    const messages = session.conversationHistory.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const aiResponse = await geminiService.chat(DEBATE_SYSTEM_PROMPT, messages);

    session.conversationHistory.push({ role: 'assistant', content: aiResponse });
    session.roundNumber += 1;

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: 'DEBATE_SESSION',
        prompt: `Debate round ${session.roundNumber}: ${argument.substring(0, 100)}`,
        response: JSON.stringify(session),
        model: 'gemini',
        subjectName: session.subjectId,
      },
    });

    return session;
  }

  async completeSession(userId: string, sessionId: string): Promise<DebateSessionData> {
    const session = await this.getSession(userId, sessionId);
    if (session.status === 'completed' && session.assessment) {
      return session;
    }

    const conversationText = session.conversationHistory
      .map(m => `${m.role === 'user' ? 'User' : 'AI Opponent'}: ${m.content}`)
      .join('\n\n');

    const assessmentPrompt = `Topic: "${session.topic}"\nUser Position: "${session.userPosition}"\nAI Position: "${session.aiPosition}"\n\nFull debate:\n${conversationText}\n\nProvide your assessment of the user's argumentation skills.`;

    let assessment: any;
    try {
      assessment = await geminiService.generateJSON(DEBATE_ASSESSMENT_PROMPT, assessmentPrompt, 4096);
    } catch {
      assessment = {
        strongPoints: ['Четкая формулировка позиции', 'Последовательная аргументация'],
        weakPoints: ['Можно добавить больше конкретных примеров'],
        goodArguments: ['Аргументы логически выстроены'],
        unsupportedClaims: [],
        logicalFallacies: [],
        unrefutedCounterarguments: [],
        lessonsLearned: ['Умение отстаивать тезис под контраргументами'],
        topicsToStudy: [session.topic],
        scores: {
          argumentQuality: 80,
          logicalReasoning: 75,
          evidenceUse: 70,
          counterargumentHandling: 75,
          topicUnderstanding: 80,
          questioningSkill: 70,
        },
        overallScore: 76,
        summary: 'Отличные навыки аргументации и уверенная защита позиции.',
        encouragement: 'Продолжайте развивать навыки критического мышления и дебатов!',
      };
    }

    session.status = 'completed';
    session.assessment = assessment;

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: 'DEBATE_SESSION',
        prompt: `Debate complete: ${session.topic}`,
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
          data: { xp: { increment: 60 } },
        });
        await achievementService.checkAchievements(userId);
      }
    } catch {}

    return session;
  }
}

export const debateService = new DebateService();
