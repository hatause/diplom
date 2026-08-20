import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../plugins/auth.js';

export async function achievementRoutes(app: FastifyInstance) {
  // Get all achievements and user's unlocked ones
  app.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const userId = request.user!.userId;

    const [allAchievements, userAchievements, profile] = await Promise.all([
      prisma.achievement.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.userAchievement.findMany({
        where: { userId },
        select: { achievementId: true, unlockedAt: true },
      }),
      prisma.studentProfile.findUnique({
        where: { userId },
        select: { xp: true, streak: true, bestStreak: true, dailyGoal: true },
      }),
    ]);

    const unlockedIds = new Set(userAchievements.map(ua => ua.achievementId));

    return {
      success: true,
      data: {
        achievements: allAchievements.map(a => ({
          ...a,
          isUnlocked: unlockedIds.has(a.id),
          unlockedAt: userAchievements.find(ua => ua.achievementId === a.id)?.unlockedAt || null,
        })),
        stats: {
          xp: profile?.xp || 0,
          streak: profile?.streak || 0,
          bestStreak: profile?.bestStreak || 0,
          dailyGoal: profile?.dailyGoal || 3,
          unlockedCount: userAchievements.length,
          totalCount: allAchievements.length,
        },
      },
    };
  });
}
