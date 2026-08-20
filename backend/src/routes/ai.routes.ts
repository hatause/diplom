import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../plugins/auth.js';
import { tutorService, resultAnalysisService, recommendationService, explanationService } from '../services/ai/tutor.service.js';
import { aiChatSchema, aiAnalyzeSchema, aiExplainSchema } from '../schemas/index.js';

export async function aiRoutes(app: FastifyInstance) {
  // AI Tutor chat
  app.post('/chat', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const data = aiChatSchema.parse(request.body);
    const response = await tutorService.chat(request.user!.userId, data.message, {
      subjectId: data.subjectId,
      topicId: data.topicId,
      attemptId: data.attemptId,
      conversationHistory: data.conversationHistory,
    });
    return { success: true, data: { message: response } };
  });

  // Analyze test result
  app.post('/analyze-result', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const { attemptId } = aiAnalyzeSchema.parse(request.body);
    const analysis = await resultAnalysisService.analyze(request.user!.userId, attemptId);
    return { success: true, data: analysis };
  });

  // Explain a specific question
  app.post('/explain', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const { questionId, attemptId } = aiExplainSchema.parse(request.body);
    const explanation = await explanationService.explain(request.user!.userId, questionId, attemptId);
    return { success: true, data: { explanation } };
  });

  // Get AI recommendations
  app.get('/recommendations', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const recommendations = await recommendationService.getRecommendations(request.user!.userId);
    return { success: true, data: recommendations };
  });
}
