export interface AttemptProgress {
  answers: Record<string, string | string[] | null>;
  timeSpent: Record<string, number>;
  currentIdx: number;
  elapsed: number;
}

export function attemptDraftKey(userId: string, attemptId: string): string {
  return `aitutor-attempt-v1:${userId}:${attemptId}`;
}

export function readAttemptDraft(key: string, questionIds: string[]): AttemptProgress | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    if (!value || !Number.isInteger(value.currentIdx) || !Number.isInteger(value.elapsed) || value.elapsed < 0) return null;
    if (!value.answers || typeof value.answers !== 'object' || Array.isArray(value.answers)) return null;
    if (!value.timeSpent || typeof value.timeSpent !== 'object' || Array.isArray(value.timeSpent)) return null;
    const validAnswer = (answer: unknown) => answer === null || typeof answer === 'string' || (Array.isArray(answer) && answer.every(item => typeof item === 'string'));
    if (Object.entries(value.answers).some(([id, answer]) => !questionIds.includes(id) || !validAnswer(answer))) return null;
    if (Object.entries(value.timeSpent).some(([id, time]) => !questionIds.includes(id) || !Number.isInteger(time) || Number(time) < 0)) return null;
    return { answers: value.answers, timeSpent: value.timeSpent, currentIdx: Math.min(Math.max(0, value.currentIdx), Math.max(0, questionIds.length - 1)), elapsed: value.elapsed };
  } catch { return null; }
}

export function clearAttemptDraft(key: string | null): void {
  if (!key) return;
  try { localStorage.removeItem(key); } catch { /* A completed attempt is still authoritative on the server. */ }
}
