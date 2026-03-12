import 'server-only';

import { z } from 'zod';

const webEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1).default('postgres://postgres:postgres@localhost:5432/beacon'),
  AUTH_SECRET: z.string().min(1).default('replace-me'),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_EMAIL_FROM: z.string().optional(),
  AUTH_EMAIL_SERVER: z.string().optional(),
  AUTH_TRUST_HOST: z.string().optional(),
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

  if (isPlaceholder(env.AUTH_SECRET)) {
    missing.push('AUTH_SECRET');
  }

  if (!env.AUTH_GOOGLE_ID) {
    missing.push('AUTH_GOOGLE_ID');
  }

  if (!env.AUTH_GOOGLE_SECRET) {
    missing.push('AUTH_GOOGLE_SECRET');
  }

  if (!env.AUTH_EMAIL_SERVER) {
    missing.push('AUTH_EMAIL_SERVER');
  }

  if (!env.AUTH_EMAIL_FROM) {
    missing.push('AUTH_EMAIL_FROM');
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
  return value.trim().length === 0 || value === 'replace-me';
}
