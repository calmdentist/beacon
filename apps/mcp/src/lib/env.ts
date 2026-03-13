import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MCP_PORT: z.coerce.number().default(4000),
  MCP_PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),
  BEACON_API_URL: z.string().url().default('http://localhost:3000'),
  BEACON_API_TOKEN: z.string().min(1).default('replace-me'),
  MCP_AUTH_MODE: z.enum(['oauth', 'none']).optional(),
  MCP_DEV_USER_ID: z.string().trim().optional(),
  MCP_REQUIRED_SCOPES: z.string().default('mcp:tools'),
  MCP_ALLOWED_HOSTS: z.string().optional(),

  MCP_OAUTH_ISSUER_URL: z.string().url().optional(),
  MCP_OAUTH_BRIDGE_URL: z.string().url().optional(),
  MCP_OAUTH_BRIDGE_SHARED_SECRET: z.string().min(32).optional(),
  MCP_OAUTH_SESSION_SECRET: z.string().min(32).optional(),
  MCP_OAUTH_TOKEN_SECRET: z.string().min(32).optional(),
  MCP_OAUTH_COOKIE_NAME: z.string().default('vibecast-mcp-session'),
  MCP_OAUTH_COOKIE_DOMAIN: z.string().optional(),
  MCP_OAUTH_COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  MCP_OAUTH_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 10),
  MCP_OAUTH_AUTH_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60),
  MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  MCP_OAUTH_SCOPES_SUPPORTED: z.string().optional(),
  MCP_OAUTH_ENABLE_DCR: z.enum(['true', 'false']).optional(),
  MCP_OAUTH_RESOURCE_NAME: z.string().default('Vibecast MCP')
});

const parsed = envSchema.parse(process.env);

const authMode = parsed.MCP_AUTH_MODE ?? (parsed.NODE_ENV === 'production' ? 'oauth' : 'none');
const requiredScopes = parseList(parsed.MCP_REQUIRED_SCOPES);
const allowedHosts = parseList(parsed.MCP_ALLOWED_HOSTS);

if (parsed.NODE_ENV === 'production' && parsed.BEACON_API_TOKEN === 'replace-me') {
  throw new Error('MCP BEACON_API_TOKEN must be configured in production.');
}

if (parsed.NODE_ENV === 'production' && authMode === 'none') {
  throw new Error('MCP_AUTH_MODE=none is only allowed for local testing.');
}

let oauth:
  | {
      issuerUrl: string;
      bridgeUrl: string;
      bridgeSharedSecret: string;
      sessionSecret: string;
      tokenSecret: string;
      cookieName: string;
      cookieDomain?: string;
      cookieSecure: boolean;
      sessionTtlSeconds: number;
      authCodeTtlSeconds: number;
      accessTokenTtlSeconds: number;
      refreshTokenTtlSeconds: number;
      scopesSupported: string[];
      enableDynamicClientRegistration: boolean;
      resourceName: string;
    }
  | null = null;

if (authMode === 'oauth') {
  const missing: string[] = [];

  if (!parsed.MCP_OAUTH_BRIDGE_SHARED_SECRET) missing.push('MCP_OAUTH_BRIDGE_SHARED_SECRET');
  if (!parsed.MCP_OAUTH_SESSION_SECRET) missing.push('MCP_OAUTH_SESSION_SECRET');
  if (!parsed.MCP_OAUTH_TOKEN_SECRET) missing.push('MCP_OAUTH_TOKEN_SECRET');

  if (missing.length > 0) {
    throw new Error(`Missing MCP OAuth env vars: ${missing.join(', ')}`);
  }

  const oauthScopesSupported = (() => {
    const configured = parseList(parsed.MCP_OAUTH_SCOPES_SUPPORTED);
    return configured.length > 0 ? configured : requiredScopes;
  })();

  const cookieSecure = (() => {
    if (parsed.MCP_OAUTH_COOKIE_SECURE) {
      return parsed.MCP_OAUTH_COOKIE_SECURE === 'true';
    }

    return new URL(parsed.MCP_PUBLIC_BASE_URL).protocol === 'https:';
  })();

  oauth = {
    issuerUrl: parsed.MCP_OAUTH_ISSUER_URL ?? parsed.MCP_PUBLIC_BASE_URL,
    bridgeUrl: parsed.MCP_OAUTH_BRIDGE_URL ?? new URL('/api/mcp/oauth/bridge', parsed.BEACON_API_URL).toString(),
    bridgeSharedSecret: parsed.MCP_OAUTH_BRIDGE_SHARED_SECRET!,
    sessionSecret: parsed.MCP_OAUTH_SESSION_SECRET!,
    tokenSecret: parsed.MCP_OAUTH_TOKEN_SECRET!,
    cookieName: parsed.MCP_OAUTH_COOKIE_NAME,
    cookieDomain: parsed.MCP_OAUTH_COOKIE_DOMAIN?.trim() || undefined,
    cookieSecure,
    sessionTtlSeconds: parsed.MCP_OAUTH_SESSION_TTL_SECONDS,
    authCodeTtlSeconds: parsed.MCP_OAUTH_AUTH_CODE_TTL_SECONDS,
    accessTokenTtlSeconds: parsed.MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: parsed.MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS,
    scopesSupported: oauthScopesSupported,
    enableDynamicClientRegistration: parsed.MCP_OAUTH_ENABLE_DCR !== 'false',
    resourceName: parsed.MCP_OAUTH_RESOURCE_NAME
  };
}

const devUserId = parsed.MCP_DEV_USER_ID?.trim() || 'local-dev-user';

export const env = {
  ...parsed,
  authMode,
  requiredScopes,
  allowedHosts,
  devUserId,
  oauth,
  mcpServerUrl: new URL('/mcp', parsed.MCP_PUBLIC_BASE_URL).toString()
};

function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
