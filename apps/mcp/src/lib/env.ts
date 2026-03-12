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
  MCP_USER_ID_CLAIM: z.string().default('sub'),
  MCP_ALLOWED_HOSTS: z.string().optional(),

  MCP_OAUTH_ISSUER_URL: z.string().url().optional(),
  MCP_OAUTH_AUTHORIZATION_ENDPOINT: z.string().url().optional(),
  MCP_OAUTH_TOKEN_ENDPOINT: z.string().url().optional(),
  MCP_OAUTH_REGISTRATION_ENDPOINT: z.string().url().optional(),
  MCP_OAUTH_REVOCATION_ENDPOINT: z.string().url().optional(),
  MCP_OAUTH_INTROSPECTION_ENDPOINT: z.string().url().optional(),
  MCP_OAUTH_JWKS_URL: z.string().url().optional(),
  MCP_OAUTH_AUDIENCE: z.string().optional(),
  MCP_OAUTH_SCOPES_SUPPORTED: z.string().optional()
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
      authorizationEndpoint: string;
      tokenEndpoint: string;
      registrationEndpoint?: string;
      revocationEndpoint?: string;
      introspectionEndpoint?: string;
      jwksUrl: string;
      audience?: string;
      scopesSupported: string[];
    }
  | null = null;

if (authMode === 'oauth') {
  const missing: string[] = [];

  if (!parsed.MCP_OAUTH_ISSUER_URL) missing.push('MCP_OAUTH_ISSUER_URL');
  if (!parsed.MCP_OAUTH_AUTHORIZATION_ENDPOINT) missing.push('MCP_OAUTH_AUTHORIZATION_ENDPOINT');
  if (!parsed.MCP_OAUTH_TOKEN_ENDPOINT) missing.push('MCP_OAUTH_TOKEN_ENDPOINT');
  if (!parsed.MCP_OAUTH_JWKS_URL) missing.push('MCP_OAUTH_JWKS_URL');

  if (missing.length > 0) {
    throw new Error(`Missing MCP OAuth env vars: ${missing.join(', ')}`);
  }

  oauth = {
    // Reuse required tool scopes when dedicated OAuth scope list is not provided.
    scopesSupported: (() => {
      const configured = parseList(parsed.MCP_OAUTH_SCOPES_SUPPORTED);
      return configured.length > 0 ? configured : requiredScopes;
    })(),
    issuerUrl: parsed.MCP_OAUTH_ISSUER_URL!,
    authorizationEndpoint: parsed.MCP_OAUTH_AUTHORIZATION_ENDPOINT!,
    tokenEndpoint: parsed.MCP_OAUTH_TOKEN_ENDPOINT!,
    registrationEndpoint: parsed.MCP_OAUTH_REGISTRATION_ENDPOINT,
    revocationEndpoint: parsed.MCP_OAUTH_REVOCATION_ENDPOINT,
    introspectionEndpoint: parsed.MCP_OAUTH_INTROSPECTION_ENDPOINT,
    jwksUrl: parsed.MCP_OAUTH_JWKS_URL!,
    audience: parsed.MCP_OAUTH_AUDIENCE
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
