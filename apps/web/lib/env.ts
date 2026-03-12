import 'server-only';

import { z } from 'zod';

const webEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1).default('postgres://postgres:postgres@localhost:5432/beacon'),
  NEON_AUTH_BASE_URL: z.string().url().default('https://replace-me.neon.tech'),
  NEON_AUTH_COOKIE_SECRET: z.string().min(32).default('replace-me-with-a-32-char-cookie-secret'),
  NEON_AUTH_SESSION_DATA_TTL: z.coerce.number().int().positive().optional(),
  NEON_AUTH_COOKIE_DOMAIN: z.string().optional(),
  BEACON_API_TOKEN: z.string().min(1).default('replace-me'),
  OPENAI_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536)
});

export type WebEnv = z.infer<typeof webEnvSchema>;

let cachedEnv: WebEnv | null = null;

export function getWebEnv(): WebEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = webEnvSchema.parse(process.env);
  return cachedEnv;
}

export function assertProductionWebEnv(): void {
  const env = getWebEnv();

  if (env.NODE_ENV !== 'production') {
    return;
  }

  const missing: string[] = [];

  if (isPlaceholder(env.NEON_AUTH_BASE_URL)) {
    missing.push('NEON_AUTH_BASE_URL');
  }

  if (isPlaceholder(env.NEON_AUTH_COOKIE_SECRET)) {
    missing.push('NEON_AUTH_COOKIE_SECRET');
  }

  if (isPlaceholder(env.BEACON_API_TOKEN)) {
    missing.push('BEACON_API_TOKEN');
  }

  if (!env.OPENAI_API_KEY) {
    missing.push('OPENAI_API_KEY');
  }

  if (missing.length > 0) {
    throw new Error(`Production env is missing required values: ${missing.join(', ')}`);
  }
}

function isPlaceholder(value: string): boolean {
  return value.trim().length === 0 || value.includes('replace-me');
}
