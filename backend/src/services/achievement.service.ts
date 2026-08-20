import { prisma } from '../lib/prisma.js';
import { XP_VALUES } from '../config/constants.js';

export class AchievementService {
  async checkAchievements(userId: string) {
    const [profile, achievements, unlocked, userAttempts] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { userId } }),
      prisma.achievement.findMany(),
      prisma.userAchievement.findMany({ where: { userId } }),
      prisma.attempt.findMany({ where: { userId, status: 'COMPLETED' }, include: { test: true } }),
    ]);

    if (!profile) return;

    const unlockedIds = new Set(unlocked.map(u => u.achievementId));
    let totalXpEarned = 0;

    for (const ach of achievements) {
      if (unlockedIds.has(ach.id)) continue;

      const condition = ach.condition as any;
      let shouldUnlock = false;

      switch (condition.type) {
        case 'test_count':
          shouldUnlock = userAttempts.length >= condition.value;
          break;
        case 'question_count':
          const totalQuestions = userAttempts.reduce((acc, a) => acc + (a.test?.questionCount || 0), 0);
          shouldUnlock = totalQuestions >= condition.value;
          break;
        case 'perfect_score':
          shouldUnlock = userAttempts.some(a => a.percentage === 100);
          break;
        case 'streak':
          shouldUnlock = profile.bestStreak >= condition.value;
          break;
        case 'mastery':
          const mastery = await prisma.topicProgress.findFirst({
            where: { userId, masteryScore: { gte: condition.value } },
          });
          shouldUnlock = !!mastery;
          break;
        case 'night_test':
          shouldUnlock = userAttempts.some(a => {
            if (!a.completedAt) return false;
            const hours = new Date(a.completedAt).getHours();
            return hours >= 23 || hours < 4;
          });
          break;
        case 'speed':
          shouldUnlock = userAttempts.some(a => (a.totalTime || 99999) <= condition.value && a.percentage === 100);
          break;
      }

      if (shouldUnlock) {
        await prisma.userAchievement.create({
          data: { userId, achievementId: ach.id },
        });
        totalXpEarned += ach.xpReward;
      }
    }

    if (totalXpEarned > 0) {
      await prisma.studentProfile.update({
        where: { userId },
        data: { xp: { increment: totalXpEarned } },
      });
    }
  }
}

export const achievementService = new AchievementService();
