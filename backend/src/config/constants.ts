export const APP_NAME = 'AI Tutor';
export const API_PREFIX = '/api/v1';

export const SALT_ROUNDS = 12;

export const MASTERY_LEVELS = {
  BEGINNER: { min: 0, max: 30, label: 'Beginner' },
  DEVELOPING: { min: 30, max: 60, label: 'Developing' },
  GOOD: { min: 60, max: 80, label: 'Good' },
  STRONG: { min: 80, max: 95, label: 'Strong' },
  MASTERED: { min: 95, max: 100, label: 'Mastered' },
} as const;

export const XP_VALUES = {
  TEST_COMPLETED: 10,
  CORRECT_ANSWER: 5,
  PERFECT_SCORE: 50,
  STREAK_BONUS: 20,
} as const;

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
export const QUESTION_TYPES = ['single_choice', 'multiple_choice', 'true_false', 'short_answer'] as const;

export const MAX_AI_RETRIES = 3;
export const AI_RETRY_BASE_DELAY_MS = 1000;
export const MAX_AI_CONTEXT_TOKENS = 2000;
