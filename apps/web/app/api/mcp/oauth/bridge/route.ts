import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { getCurrentUserId } from '@/lib/auth';
import { getWebEnv } from '@/lib/env';

const BRIDGE_TOKEN_AUDIENCE = 'vibecast-mcp-oauth-bridge';

export async function GET(request: Request) {
  const env = getWebEnv();
  const requestUrl = new URL(request.url);
  const returnToRaw = requestUrl.searchParams.get('return_to');

  if (!returnToRaw) {
    return NextResponse.json({ error: 'Missing return_to parameter' }, { status: 400 });
  }

  if (!env.MCP_PUBLIC_BASE_URL) {
    return NextResponse.json(
      { error: 'Server misconfigured: MCP_PUBLIC_BASE_URL' },
      { status: 500 }
    );
  }

  if (!env.MCP_OAUTH_BRIDGE_SHARED_SECRET) {
    return NextResponse.json(
      { error: 'Server misconfigured: MCP_OAUTH_BRIDGE_SHARED_SECRET' },
      { status: 500 }
    );
  }

  let returnTo: URL;
  try {
    returnTo = new URL(returnToRaw);
  } catch {
    return NextResponse.json({ error: 'Invalid return_to URL' }, { status: 400 });
  }

  const expectedMcpOrigin = new URL(env.MCP_PUBLIC_BASE_URL).origin;
  if (returnTo.origin !== expectedMcpOrigin || returnTo.pathname !== '/authorize') {
    return NextResponse.json({ error: 'Invalid return_to destination' }, { status: 400 });
  }

  const { data: session } = await auth.getSession();
  const user = session?.user;

  if (!user?.id || !user.email) {
    const signInUrl = new URL('/auth/sign-in', requestUrl);
    signInUrl.searchParams.set('callbackURL', requestUrl.toString());
    return NextResponse.redirect(signInUrl);
  }

  const userId = await getCurrentUserId();

  const bridgeToken = await new SignJWT({
    sub: userId,
    email: user.email,
    name: user.name ?? undefined
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(env.NEXT_PUBLIC_APP_URL)
    .setAudience(BRIDGE_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.MCP_OAUTH_BRIDGE_TOKEN_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(env.MCP_OAUTH_BRIDGE_SHARED_SECRET));

  const callbackUrl = new URL('/oauth/callback', env.MCP_PUBLIC_BASE_URL);
  callbackUrl.searchParams.set('bridge_token', bridgeToken);
  callbackUrl.searchParams.set('return_to', returnTo.toString());

  return NextResponse.redirect(callbackUrl);
}
