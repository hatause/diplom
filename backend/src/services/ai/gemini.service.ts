import { GoogleGenerativeAI, GenerativeModel, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { ApiError } from '../../utils/api-error.js';
import { MAX_AI_RETRIES, AI_RETRY_BASE_DELAY_MS } from '../../config/constants.js';

export class GeminiService {
  private model: GenerativeModel | null = null;
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    if (env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({
        model: env.GEMINI_MODEL,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ],
      });
    } else {
      logger.warn('GEMINI_API_KEY not set — AI features disabled');
    }
  }

  private ensureModel(): GenerativeModel {
    if (!this.model) {
      throw ApiError.serviceUnavailable('AI service not configured. Please set GEMINI_API_KEY.');
    }
    return this.model;
  }

  async generateJSON<T>(systemPrompt: string, userPrompt: string, maxOutputTokens = 4096): Promise<T> {
    const model = this.ensureModel();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_AI_RETRIES; attempt++) {
      try {
        const result = await model.generateContent({
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens,
            temperature: 0.7,
          },
        });

        const response = result.response;
        const text = response.text();

        if (!text || text.trim().length === 0) {
          throw new Error('Empty response from AI');
        }

        // Parse JSON - handle potential markdown code blocks
        let jsonStr = text.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }

        const parsed = JSON.parse(jsonStr) as T;
        return parsed;
      } catch (error: any) {
        lastError = error;
        logger.warn({ attempt: attempt + 1, error: error.message }, 'AI generation attempt failed');

        if (error.message?.includes('429') || error.message?.includes('rate limit')) {
          const delay = AI_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (attempt < MAX_AI_RETRIES - 1) {
          const delay = AI_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error({ error: lastError }, 'AI generation failed after all retries');
    throw ApiError.serviceUnavailable('AI service temporarily unavailable. Please try again.');
  }

  async generateText(systemPrompt: string, userPrompt: string, maxOutputTokens = 2048): Promise<string> {
    const model = this.ensureModel();

    for (let attempt = 0; attempt < MAX_AI_RETRIES; attempt++) {
      try {
        const result = await model.generateContent({
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] },
          ],
          generationConfig: { maxOutputTokens, temperature: 0.7 },
        });

        return result.response.text();
      } catch (error: any) {
        if (attempt < MAX_AI_RETRIES - 1) {
          const delay = AI_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw ApiError.serviceUnavailable('AI service temporarily unavailable.');
  }

  async chat(systemPrompt: string, messages: { role: string; content: string }[], maxOutputTokens = 2048): Promise<string> {
    const model = this.ensureModel();

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: m.content }],
    }));

    // Prepend system instructions to first message
    if (contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `${systemPrompt}\n\n---\n\n${contents[0].parts[0].text}`;
    }

    try {
      const result = await model.generateContent({
        contents,
        generationConfig: { maxOutputTokens, temperature: 0.7 },
      });
      return result.response.text();
    } catch (error: any) {
      logger.error({ error: error.message }, 'AI chat failed');
      throw ApiError.serviceUnavailable('AI service temporarily unavailable.');
    }
  }

  isConfigured(): boolean {
    return this.model !== null;
  }
}

export const geminiService = new GeminiService();
