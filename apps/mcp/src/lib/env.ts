import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MCP_PORT: z.coerce.number().default(4000),
  BEACON_API_URL: z.string().url().default('http://localhost:3000'),
  BEACON_API_TOKEN: z.string().min(1).default('replace-me')
});

const parsed = envSchema.parse(process.env);

if (parsed.NODE_ENV === 'production' && parsed.BEACON_API_TOKEN === 'replace-me') {
  throw new Error('MCP BEACON_API_TOKEN must be configured in production.');
}

export const env = parsed;
