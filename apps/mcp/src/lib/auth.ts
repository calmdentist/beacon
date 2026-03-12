import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthMetadataRouter
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';

import { env } from './env.js';

const JWT_CLOCK_TOLERANCE_SECONDS = 10;

export function createAuthMiddleware() {
  if (env.authMode !== 'oauth') {
    return {
      authMiddleware: null,
      authMetadataRouter: null
    };
  }

  if (!env.oauth) {
    throw new Error('OAuth mode is enabled, but OAuth configuration is missing.');
  }

  const mcpServerUrl = new URL(env.mcpServerUrl);
  const oauthMetadata: OAuthMetadata = {
    issuer: env.oauth.issuerUrl,
    authorization_endpoint: env.oauth.authorizationEndpoint,
    token_endpoint: env.oauth.tokenEndpoint,
    registration_endpoint: env.oauth.registrationEndpoint,
    revocation_endpoint: env.oauth.revocationEndpoint,
    introspection_endpoint: env.oauth.introspectionEndpoint,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: env.oauth.scopesSupported
  };

  const authMetadataRouter = mcpAuthMetadataRouter({
    oauthMetadata,
    resourceServerUrl: mcpServerUrl,
    scopesSupported: env.requiredScopes,
    resourceName: 'Beacon MCP'
  });

  const authMiddleware = requireBearerAuth({
    verifier: createJwtTokenVerifier(),
    requiredScopes: env.requiredScopes,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl)
  });

  return {
    authMiddleware,
    authMetadataRouter
  };
}

export function resolveUserIdFromAuth(authInfo: AuthInfo | undefined): string {
  if (env.authMode === 'none') {
    return env.devUserId;
  }

  const userId = authInfo?.extra?.userId;
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    throw new Error('Missing user identity in OAuth token.');
  }

  return userId;
}

function createJwtTokenVerifier(): OAuthTokenVerifier {
  if (!env.oauth) {
    throw new Error('OAuth configuration is not available.');
  }

  const jwks = createRemoteJWKSet(new URL(env.oauth.jwksUrl));

  return {
    verifyAccessToken: async (token) => {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: env.oauth?.issuerUrl,
        audience: env.oauth?.audience || undefined,
        clockTolerance: JWT_CLOCK_TOLERANCE_SECONDS
      });

      const userId = resolveUserIdFromPayload(payload, env.MCP_USER_ID_CLAIM);

      return {
        token,
        clientId: resolveClientId(payload),
        scopes: resolveScopes(payload),
        expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
        resource: resolveResource(payload),
        extra: {
          userId,
          email: readClaim(payload, 'email')
        }
      };
    }
  };
}

function resolveUserIdFromPayload(payload: JWTPayload, claimPath: string): string {
  const fromClaim = readClaim(payload, claimPath);

  if (typeof fromClaim === 'string' && fromClaim.trim().length > 0) {
    return fromClaim;
  }

  if (typeof payload.sub === 'string' && payload.sub.trim().length > 0) {
    return payload.sub;
  }

  throw new Error(`OAuth token missing required user identity claim "${claimPath}".`);
}

function resolveClientId(payload: JWTPayload): string {
  const clientId = readClaim(payload, 'client_id');
  if (typeof clientId === 'string' && clientId.trim().length > 0) {
    return clientId;
  }

  const authorizedParty = payload.azp;
  if (typeof authorizedParty === 'string' && authorizedParty.trim().length > 0) {
    return authorizedParty;
  }

  if (typeof payload.sub === 'string' && payload.sub.trim().length > 0) {
    return payload.sub;
  }

  return 'unknown-client';
}

function resolveScopes(payload: JWTPayload): string[] {
  const scopes = new Set<string>();

  const scopeClaim = readClaim(payload, 'scope');
  if (typeof scopeClaim === 'string') {
    for (const scope of scopeClaim.split(' ')) {
      const normalized = scope.trim();
      if (normalized) {
        scopes.add(normalized);
      }
    }
  }

  const scpClaim = readClaim(payload, 'scp');
  if (Array.isArray(scpClaim)) {
    for (const scope of scpClaim) {
      if (typeof scope === 'string' && scope.trim()) {
        scopes.add(scope.trim());
      }
    }
  }

  return [...scopes];
}

function resolveResource(payload: JWTPayload): URL | undefined {
  const audience = payload.aud;

  if (typeof audience === 'string') {
    return tryParseUrl(audience);
  }

  if (Array.isArray(audience) && audience.length > 0 && typeof audience[0] === 'string') {
    return tryParseUrl(audience[0]);
  }

  return undefined;
}

function tryParseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function readClaim(payload: JWTPayload, claimPath: string): unknown {
  const segments = claimPath
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return undefined;
  }

  let current: unknown = payload as Record<string, unknown>;

  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
