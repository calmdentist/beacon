import { createNeonAuth } from '@neondatabase/auth/next/server';

import { getWebEnv } from '@/lib/env';

const env = getWebEnv();

export const auth = createNeonAuth({
  baseUrl: env.NEON_AUTH_BASE_URL,
  cookies: {
    secret: env.NEON_AUTH_COOKIE_SECRET,
    sessionDataTtl: env.NEON_AUTH_SESSION_DATA_TTL,
    domain: env.NEON_AUTH_COOKIE_DOMAIN
  }
});
