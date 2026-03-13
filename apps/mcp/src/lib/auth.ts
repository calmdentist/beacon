import crypto from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import express from 'express';
import { SignJWT, decodeJwt, jwtVerify } from 'jose';

import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import {
  InvalidGrantError,
  InvalidScopeError,
  InvalidTargetError,
  InvalidTokenError
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import type { AuthorizationParams, OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens
} from '@modelcontextprotocol/sdk/shared/auth.js';

import { env } from './env.js';

const JWT_CLOCK_TOLERANCE_SECONDS = 10;
const BRIDGE_TOKEN_AUDIENCE = 'vibecast-mcp-oauth-bridge';
const SESSION_TOKEN_AUDIENCE = 'vibecast-mcp-oauth-session';

type OAuthBridgeSession = {
  userId: string;
  email?: string;
  name?: string;
};

type AuthorizationCodeRecord = {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string;
  userId: string;
  email?: string;
  expiresAt: number;
};

type RefreshTokenRecord = {
  token: string;
  clientId: string;
  scopes: string[];
  resource: string;
  userId: string;
  email?: string;
  expiresAt: number;
};

type OAuthProviderOptions = {
  issuerUrl: string;
  bridgeUrl: string;
  mcpServerUrl: string;
  requiredScopes: string[];
  scopesSupported: string[];
  sessionTtlSeconds: number;
  authCodeTtlSeconds: number;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  bridgeSharedSecret: string;
  sessionSecret: string;
  tokenSecret: string;
  sessionCookieName: string;
  dynamicClientRegistrationEnabled: boolean;
};

export function createAuthMiddleware(): {
  authMiddleware: RequestHandler | null;
  authRouter: RequestHandler | null;
} {
  if (env.authMode !== 'oauth') {
    return {
      authMiddleware: null,
      authRouter: null
    };
  }

  if (!env.oauth) {
    throw new Error('OAuth mode is enabled, but OAuth configuration is missing.');
  }
  const oauth = env.oauth;

  const provider = new InMemoryOAuthServerProvider({
    issuerUrl: oauth.issuerUrl,
    bridgeUrl: oauth.bridgeUrl,
    mcpServerUrl: env.mcpServerUrl,
    requiredScopes: env.requiredScopes,
    scopesSupported: oauth.scopesSupported,
    sessionTtlSeconds: oauth.sessionTtlSeconds,
    authCodeTtlSeconds: oauth.authCodeTtlSeconds,
    accessTokenTtlSeconds: oauth.accessTokenTtlSeconds,
    refreshTokenTtlSeconds: oauth.refreshTokenTtlSeconds,
    bridgeSharedSecret: oauth.bridgeSharedSecret,
    sessionSecret: oauth.sessionSecret,
    tokenSecret: oauth.tokenSecret,
    sessionCookieName: oauth.cookieName,
    dynamicClientRegistrationEnabled: oauth.enableDynamicClientRegistration
  });

  const authRouter = express.Router();

  authRouter.get('/oauth/callback', async (req, res) => {
    try {
      const bridgeToken = queryParam(req, 'bridge_token');
      const returnToRaw = queryParam(req, 'return_to');

      if (!bridgeToken || !returnToRaw) {
        res.status(400).send('Missing bridge token or return_to.');
        return;
      }

      const returnTo = validateAuthorizeReturnTo(returnToRaw);
      const bridgePayload = await provider.verifyBridgeToken(bridgeToken);

      const sessionToken = await provider.signSessionToken({
        userId: bridgePayload.userId,
        email: bridgePayload.email,
        name: bridgePayload.name
      });

      if (!oauth.cookieSecure) {
        console.warn('MCP OAuth session cookie is not marked secure. Do not use this in production.');
      }

      res.cookie(oauth.cookieName, sessionToken, {
        httpOnly: true,
        secure: oauth.cookieSecure,
        sameSite: 'lax',
        path: '/',
        domain: oauth.cookieDomain,
        maxAge: oauth.sessionTtlSeconds * 1000
      });

      res.redirect(returnTo.toString());
    } catch (error) {
      console.error('Failed to complete OAuth bridge callback', error);
      res.status(400).send('Unable to complete sign-in.');
    }
  });

  authRouter.use(
    mcpAuthRouter({
      provider,
      issuerUrl: new URL(oauth.issuerUrl),
      baseUrl: new URL(env.MCP_PUBLIC_BASE_URL),
      resourceServerUrl: new URL(env.mcpServerUrl),
      scopesSupported: oauth.scopesSupported,
      resourceName: oauth.resourceName
    })
  );

  const authMiddleware = requireBearerAuth({
    verifier: provider,
    requiredScopes: env.requiredScopes,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(env.mcpServerUrl))
  });

  return {
    authMiddleware,
    authRouter
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

class InMemoryOAuthServerProvider implements OAuthServerProvider {
  readonly clientsStore: OAuthRegisteredClientsStore;

  private readonly options: OAuthProviderOptions;
  private readonly authorizationCodes = new Map<string, AuthorizationCodeRecord>();
  private readonly refreshTokens = new Map<string, RefreshTokenRecord>();
  private readonly revokedAccessTokens = new Map<string, number>();
  private readonly clients = new Map<string, OAuthClientInformationFull>();

  private readonly bridgeSecret: Uint8Array;
  private readonly sessionSecret: Uint8Array;
  private readonly tokenSecret: Uint8Array;

  constructor(options: OAuthProviderOptions) {
    this.options = options;
    this.bridgeSecret = new TextEncoder().encode(options.bridgeSharedSecret);
    this.sessionSecret = new TextEncoder().encode(options.sessionSecret);
    this.tokenSecret = new TextEncoder().encode(options.tokenSecret);

    const clientsStore: OAuthRegisteredClientsStore = {
      getClient: (clientId) => this.clients.get(clientId)
    };

    if (options.dynamicClientRegistrationEnabled) {
      clientsStore.registerClient = async (client) => {
        const tokenEndpointAuthMethod = client.token_endpoint_auth_method ?? 'none';
        const clientSecret = tokenEndpointAuthMethod === 'none' ? undefined : client.client_secret ?? randomToken();
        const normalized: OAuthClientInformationFull = {
          ...client,
          client_id: crypto.randomUUID(),
          client_id_issued_at: nowEpoch(),
          client_secret: clientSecret,
          token_endpoint_auth_method: tokenEndpointAuthMethod,
          grant_types: client.grant_types ?? ['authorization_code', 'refresh_token'],
          response_types: client.response_types ?? ['code']
        };

        this.clients.set(normalized.client_id, normalized);
        return normalized;
      };
    }

    this.clientsStore = clientsStore;
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    this.cleanupExpiredRecords();

    const req = res.req;
    const session = req ? await this.readSessionFromRequest(req) : null;

    if (!session) {
      if (!req) {
        throw new InvalidGrantError('Unable to resolve request context for authorization.');
      }

      const returnTo = absoluteRequestUrl(req);
      const bridgeUrl = new URL(this.options.bridgeUrl);
      bridgeUrl.searchParams.set('return_to', returnTo.toString());
      res.redirect(302, bridgeUrl.toString());
      return;
    }

    const scopes = this.normalizeGrantedScopes(params.scopes);
    const resource = this.normalizeResource(params.resource);
    const code = randomToken();

    this.authorizationCodes.set(code, {
      code,
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      scopes,
      resource,
      userId: session.userId,
      email: session.email,
      expiresAt: nowEpoch() + this.options.authCodeTtlSeconds
    });

    const redirectUrl = new URL(params.redirectUri);
    redirectUrl.searchParams.set('code', code);
    if (params.state) {
      redirectUrl.searchParams.set('state', params.state);
    }

    res.redirect(302, redirectUrl.toString());
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {
    this.cleanupExpiredRecords();

    const codeRecord = this.authorizationCodes.get(authorizationCode);
    if (!codeRecord || codeRecord.clientId !== client.client_id) {
      throw new InvalidGrantError('Invalid authorization code.');
    }

    if (codeRecord.expiresAt < nowEpoch()) {
      this.authorizationCodes.delete(authorizationCode);
      throw new InvalidGrantError('Authorization code has expired.');
    }

    return codeRecord.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL
  ): Promise<OAuthTokens> {
    this.cleanupExpiredRecords();

    const codeRecord = this.authorizationCodes.get(authorizationCode);
    if (!codeRecord) {
      throw new InvalidGrantError('Invalid authorization code.');
    }

    if (codeRecord.clientId !== client.client_id) {
      throw new InvalidGrantError('Authorization code was issued to a different client.');
    }

    if (codeRecord.expiresAt < nowEpoch()) {
      this.authorizationCodes.delete(authorizationCode);
      throw new InvalidGrantError('Authorization code has expired.');
    }

    if (redirectUri && redirectUri !== codeRecord.redirectUri) {
      throw new InvalidGrantError('redirect_uri does not match the original authorization request.');
    }

    if (resource && this.normalizeResource(resource) !== codeRecord.resource) {
      throw new InvalidTargetError('Requested resource does not match authorization grant.');
    }

    this.authorizationCodes.delete(authorizationCode);

    return this.issueTokens({
      clientId: codeRecord.clientId,
      scopes: codeRecord.scopes,
      resource: codeRecord.resource,
      userId: codeRecord.userId,
      email: codeRecord.email
    });
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL
  ): Promise<OAuthTokens> {
    this.cleanupExpiredRecords();

    const record = this.refreshTokens.get(refreshToken);
    if (!record) {
      throw new InvalidGrantError('Invalid refresh token.');
    }

    if (record.clientId !== client.client_id) {
      throw new InvalidGrantError('Refresh token was issued to a different client.');
    }

    if (record.expiresAt < nowEpoch()) {
      this.refreshTokens.delete(refreshToken);
      throw new InvalidGrantError('Refresh token has expired.');
    }

    const grantedScopes = scopes && scopes.length > 0 ? scopes : record.scopes;
    if (!grantedScopes.every((scope) => record.scopes.includes(scope))) {
      throw new InvalidScopeError('Requested scope exceeds refresh token grant.');
    }

    const normalizedResource = resource ? this.normalizeResource(resource) : record.resource;
    if (normalizedResource !== record.resource) {
      throw new InvalidTargetError('Requested resource does not match refresh token grant.');
    }

    this.refreshTokens.delete(refreshToken);

    return this.issueTokens({
      clientId: record.clientId,
      scopes: grantedScopes,
      resource: normalizedResource,
      userId: record.userId,
      email: record.email
    });
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    this.cleanupExpiredRecords();

    const { payload } = await jwtVerify(token, this.tokenSecret, {
      issuer: this.options.issuerUrl,
      audience: canonicalUrl(this.options.mcpServerUrl),
      clockTolerance: JWT_CLOCK_TOLERANCE_SECONDS
    });

    const jti = payload.jti;
    if (typeof jti === 'string') {
      const revokedUntil = this.revokedAccessTokens.get(jti);
      if (typeof revokedUntil === 'number' && revokedUntil >= nowEpoch()) {
        throw new InvalidTokenError('Access token has been revoked.');
      }
    }

    const userId = payload.sub;
    const clientId = claimString(payload, 'client_id');
    const scopeText = claimString(payload, 'scope') ?? '';
    const scopeList = scopeText
      .split(' ')
      .map((scope) => scope.trim())
      .filter(Boolean);

    if (!userId || !clientId) {
      throw new InvalidTokenError('Access token is missing required claims.');
    }

    const resourceRaw = claimString(payload, 'resource');
    const resource = resourceRaw ? tryParseUrl(resourceRaw) : undefined;

    return {
      token,
      clientId,
      scopes: scopeList,
      expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
      resource,
      extra: {
        userId,
        email: claimString(payload, 'email')
      }
    };
  }

  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    const refresh = this.refreshTokens.get(request.token);
    if (refresh && refresh.clientId === client.client_id) {
      this.refreshTokens.delete(request.token);
      return;
    }

    const payload = decodeJwtSafe(request.token);
    if (!payload) {
      return;
    }

    const tokenClientId = claimString(payload, 'client_id');
    if (tokenClientId !== client.client_id) {
      return;
    }

    const jti = payload.jti;
    const exp = payload.exp;
    if (typeof jti === 'string' && typeof exp === 'number') {
      this.revokedAccessTokens.set(jti, exp);
    }
  }

  async verifyBridgeToken(token: string): Promise<OAuthBridgeSession> {
    const { payload } = await jwtVerify(token, this.bridgeSecret, {
      audience: BRIDGE_TOKEN_AUDIENCE,
      clockTolerance: JWT_CLOCK_TOLERANCE_SECONDS
    });

    const userId = payload.sub;
    if (!userId) {
      throw new InvalidGrantError('Bridge token is missing user identity.');
    }

    return {
      userId,
      email: claimString(payload, 'email') ?? undefined,
      name: claimString(payload, 'name') ?? undefined
    };
  }

  async signSessionToken(session: OAuthBridgeSession): Promise<string> {
    return new SignJWT({
      sub: session.userId,
      email: session.email,
      name: session.name
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(this.options.issuerUrl)
      .setAudience(SESSION_TOKEN_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.options.sessionTtlSeconds}s`)
      .sign(this.sessionSecret);
  }

  private async issueTokens(input: {
    clientId: string;
    scopes: string[];
    resource: string;
    userId: string;
    email?: string;
  }): Promise<OAuthTokens> {
    const now = nowEpoch();
    const expiresAt = now + this.options.accessTokenTtlSeconds;
    const accessJti = randomToken();
    const scope = input.scopes.join(' ');

    const accessToken = await new SignJWT({
      sub: input.userId,
      client_id: input.clientId,
      scope,
      resource: input.resource,
      email: input.email,
      jti: accessJti
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(this.options.issuerUrl)
      .setAudience(canonicalUrl(this.options.mcpServerUrl))
      .setIssuedAt(now)
      .setExpirationTime(expiresAt)
      .sign(this.tokenSecret);

    const refreshToken = randomToken();
    this.refreshTokens.set(refreshToken, {
      token: refreshToken,
      clientId: input.clientId,
      scopes: input.scopes,
      resource: input.resource,
      userId: input.userId,
      email: input.email,
      expiresAt: now + this.options.refreshTokenTtlSeconds
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.options.accessTokenTtlSeconds,
      scope,
      refresh_token: refreshToken
    };
  }

  private normalizeGrantedScopes(requested: string[] | undefined): string[] {
    const requestedScopes =
      requested && requested.length > 0
        ? requested.map((scope) => scope.trim()).filter(Boolean)
        : this.options.requiredScopes;

    for (const scope of requestedScopes) {
      if (!this.options.scopesSupported.includes(scope)) {
        throw new InvalidScopeError(`Unsupported scope: ${scope}`);
      }
    }

    const normalized = new Set<string>([...requestedScopes, ...this.options.requiredScopes]);
    return [...normalized];
  }

  private normalizeResource(resource: URL | undefined): string {
    if (!resource) {
      return canonicalUrl(this.options.mcpServerUrl);
    }

    const requested = canonicalUrl(resource);
    const expected = canonicalUrl(this.options.mcpServerUrl);
    if (requested !== expected) {
      throw new InvalidTargetError(`Unsupported resource: ${requested}`);
    }

    return expected;
  }

  private async readSessionFromRequest(req: Request): Promise<OAuthBridgeSession | null> {
    const cookieValue = getCookie(req, this.options.sessionCookieName);
    if (!cookieValue) {
      return null;
    }

    try {
      const { payload } = await jwtVerify(cookieValue, this.sessionSecret, {
        issuer: this.options.issuerUrl,
        audience: SESSION_TOKEN_AUDIENCE,
        clockTolerance: JWT_CLOCK_TOLERANCE_SECONDS
      });

      const userId = payload.sub;
      if (!userId) {
        return null;
      }

      return {
        userId,
        email: claimString(payload, 'email') ?? undefined,
        name: claimString(payload, 'name') ?? undefined
      };
    } catch {
      return null;
    }
  }

  private cleanupExpiredRecords(): void {
    const now = nowEpoch();

    for (const [code, record] of this.authorizationCodes.entries()) {
      if (record.expiresAt <= now) {
        this.authorizationCodes.delete(code);
      }
    }

    for (const [token, record] of this.refreshTokens.entries()) {
      if (record.expiresAt <= now) {
        this.refreshTokens.delete(token);
      }
    }

    for (const [jti, expiresAt] of this.revokedAccessTokens.entries()) {
      if (expiresAt <= now) {
        this.revokedAccessTokens.delete(jti);
      }
    }
  }
}

function queryParam(req: Request, key: string): string | undefined {
  const raw = req.query[key];
  if (typeof raw === 'string') {
    return raw;
  }
  if (Array.isArray(raw) && typeof raw[0] === 'string') {
    return raw[0];
  }
  return undefined;
}

function validateAuthorizeReturnTo(value: string): URL {
  const url = new URL(value);
  const expectedOrigin = new URL(env.MCP_PUBLIC_BASE_URL).origin;
  if (url.origin !== expectedOrigin) {
    throw new Error('Invalid return_to origin.');
  }

  if (url.pathname !== '/authorize') {
    throw new Error('Invalid return_to path.');
  }

  return url;
}

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }

  const cookies = header.split(';');
  for (const entry of cookies) {
    const [rawName, ...rest] = entry.trim().split('=');
    if (rawName !== name) {
      continue;
    }

    return decodeURIComponent(rest.join('='));
  }

  return undefined;
}

function absoluteRequestUrl(req: Request): URL {
  const host = req.get('host');
  if (!host) {
    throw new Error('Request host header is missing.');
  }

  return new URL(`${req.protocol}://${host}${req.originalUrl}`);
}

function canonicalUrl(value: string | URL): string {
  const url = typeof value === 'string' ? new URL(value) : new URL(value.toString());
  url.hash = '';

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

function tryParseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function randomToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

function claimString(payload: JWTPayload, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function decodeJwtSafe(token: string): JWTPayload | null {
  try {
    return decodeJwt(token);
  } catch {
    return null;
  }
}

type JWTPayload = {
  sub?: string;
  exp?: number;
  jti?: string;
  [key: string]: unknown;
};
