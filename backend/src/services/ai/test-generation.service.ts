import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { geminiService } from './gemini.service.js';
import { TEST_GENERATOR_SYSTEM_PROMPT } from './prompts.js';
import { generatedTestSchema, type GeneratedTest } from '../../schemas/index.js';
import { ApiError } from '../../utils/api-error.js';
import type { Difficulty, QuestionType } from '@prisma/client';

interface GenerateTestParams {
  userId: string;
  subjectId: string;
  topic?: string;
  difficulty: Difficulty;
  questionCount: number;
  questionTypes: QuestionType[];
  extraContext?: string;
}

export class TestGenerationService {
  async generate(params: GenerateTestParams): Promise<GeneratedTest> {
    const { userId, subjectId, topic, difficulty, questionCount, questionTypes } = params;

    // Get subject info
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: { topics: true },
    });
    if (!subject) throw ApiError.notFound('Subject not found');

    // Build compact learning context
    const context = await this.buildLearningContext(userId, subjectId, topic);

    // Build user prompt
    const userPrompt = this.buildGenerationPrompt({
      subjectName: subject.name,
      topic: topic || 'General',
      difficulty,
      questionCount,
      questionTypes,
      availableTopics: subject.topics.map(t => t.name),
      learningContext: context,
      extraContext: params.extraContext,
    });

    // Generate via Gemini
    const rawResult = await geminiService.generateJSON<any>(
      TEST_GENERATOR_SYSTEM_PROMPT,
      userPrompt,
      questionCount * 500 + 500, // Rough token estimate
    );

    // Validate with Zod
    const parseResult = generatedTestSchema.safeParse(rawResult);
    if (!parseResult.success) {
      logger.warn({ errors: parseResult.error.flatten(), rawResult }, 'AI returned invalid test format');

      // Attempt to fix common issues
      const fixed = this.attemptFix(rawResult);
      const retryParse = generatedTestSchema.safeParse(fixed);
      if (!retryParse.success) {
        throw ApiError.serviceUnavailable('AI generated an invalid test. Please try again.');
      }
      return retryParse.data;
    }

    return parseResult.data;
  }

  private async buildLearningContext(userId: string, subjectId: string, topic?: string): Promise<string> {
    // Get user's topic progress for this subject
    const progress = await prisma.topicProgress.findMany({
      where: {
        userId,
        topic: { subjectId },
      },
      include: { topic: { select: { name: true } } },
      orderBy: { masteryScore: 'asc' },
      take: 10,
    });

    // Get recent mistakes
    const recentAttempts = await prisma.attempt.findMany({
      where: {
        userId,
        test: { subjectId },
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      take: 3,
      include: {
        answers: {
          where: { isCorrect: false },
          include: {
            question: { select: { question: true, topic: { select: { name: true } } } },
          },
          take: 5,
        },
      },
    });

    const weakTopics = progress
      .filter(p => p.masteryScore < 60)
      .map(p => `${p.topic.name} (${Math.round(p.masteryScore)}%)`);

    const recentMistakeTopics = recentAttempts
      .flatMap(a => a.answers.map(ans => ans.question.topic?.name).filter(Boolean));

    const uniqueMistakeTopics = [...new Set(recentMistakeTopics)];

    let context = `Student learning context:\n`;
    if (weakTopics.length > 0) context += `- Weak topics: ${weakTopics.join(', ')}\n`;
    if (uniqueMistakeTopics.length > 0) context += `- Recent mistakes in: ${uniqueMistakeTopics.join(', ')}\n`;

    const overallStats = await prisma.attempt.aggregate({
      where: { userId, test: { subjectId }, status: 'COMPLETED' },
      _avg: { percentage: true },
      _count: true,
    });

    if (overallStats._count > 0) {
      context += `- Tests completed: ${overallStats._count}\n`;
      context += `- Average score: ${Math.round(overallStats._avg.percentage || 0)}%\n`;
    }

    return context;
  }

  private buildGenerationPrompt(params: {
    subjectName: string;
    topic: string;
    difficulty: string;
    questionCount: number;
    questionTypes: string[];
    availableTopics: string[];
    learningContext: string;
    extraContext?: string;
  }): string {
    return `Generate a test with the following parameters:
- Subject: ${params.subjectName}
- Topic: ${params.topic}
- Difficulty: ${params.difficulty}
- Number of questions: ${params.questionCount}
- Question types: ${params.questionTypes.join(', ')}
- Available topics in this subject: ${params.availableTopics.join(', ')}

${params.learningContext}

${params.extraContext ? `ADDITIONAL CONTEXT (e.g. LECTURE MATERIAL):\n${params.extraContext}\n\nPlease generate questions specifically covering the above additional context.\n` : ''}

IMPORTANT: 
- Focus more on the student's weak areas
- Do NOT repeat questions the student has already seen
- Generate exactly ${params.questionCount} questions
- Distribute question types: ${params.questionTypes.join(', ')}`;
  }

  private attemptFix(raw: any): any {
    if (!raw) return raw;

    // Try wrapping questions array
    if (Array.isArray(raw)) {
      return {
        title: 'Generated Test',
        subject: 'Unknown',
        difficulty: 'medium',
        questions: raw,
      };
    }

    // Ensure questions have IDs
    if (raw.questions && Array.isArray(raw.questions)) {
      raw.questions = raw.questions.map((q: any, i: number) => ({
        ...q,
        id: q.id || `q${i + 1}`,
        difficulty: q.difficulty || raw.difficulty || 'medium',
      }));
    }

    return raw;
  }
}

export const testGenerationService = new TestGenerationService();
