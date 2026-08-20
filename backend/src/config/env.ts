import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  REFRESH_TOKEN_SECRET: z.string().min(16),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  SCHEDULE_PROVIDER_MODE: z.enum(['database', 'http', 'tcp', 'push']).default('database'),
  SCHEDULE_PROVIDER_HTTP_URL: z.string().optional(),
  SCHEDULE_PROVIDER_TCP_HOST: z.string().optional(),
  SCHEDULE_PROVIDER_TCP_PORT: z.coerce.number().optional(),
  SCHEDULE_PUSH_PORT: z.coerce.number().default(3502),

  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
