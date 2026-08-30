import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
  groupCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const generateTestSchema = z.object({
  subjectId: z.string().uuid(),
  topic: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']),
  questionCount: z.number().int().min(5).max(30),
  questionTypes: z.array(z.enum(['single_choice', 'multiple_choice', 'true_false', 'short_answer'])).min(1),
  mixedMode: z.boolean().optional(),
});

export const submitTestSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    userAnswer: z.union([z.string(), z.array(z.string())]).nullable(),
    timeSpent: z.number().int().optional(),
  })),
  totalTime: z.number().int(),
});

export const aiChatSchema = z.object({
  message: z.string().min(1).max(2000),
  subjectId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
  attemptId: z.string().uuid().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).max(20).optional(),
});

export const aiAnalyzeSchema = z.object({
  attemptId: z.string().uuid(),
});

export const aiExplainSchema = z.object({
  questionId: z.string().uuid(),
  attemptId: z.string().uuid(),
});

export const feynmanCreateSchema = z.object({
  topic: z.string().min(1).max(500),
  subjectId: z.string().uuid().optional(),
});

export const feynmanExplainSchema = z.object({
  explanation: z.string().min(1).max(4000),
});

export const debateCreateSchema = z.object({
  topic: z.string().min(1).max(500),
  position: z.string().min(1).max(500),
  subjectId: z.string().uuid().optional(),
});

export const debateArgueSchema = z.object({
  argument: z.string().min(1).max(4000),
});

export const generatedQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['single_choice', 'multiple_choice', 'true_false', 'short_answer']),
  question: z.string(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]),
  explanation: z.string(),
  topic: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']),
});

export const generatedTestSchema = z.object({
  title: z.string(),
  subject: z.string(),
  topic: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']),
  questions: z.array(generatedQuestionSchema).min(1),
});

export type GeneratedTest = z.infer<typeof generatedTestSchema>;
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

