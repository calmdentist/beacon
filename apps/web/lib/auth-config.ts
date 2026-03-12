import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDb, schema } from '@beacon/db';
import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Nodemailer from 'next-auth/providers/nodemailer';

import { assertProductionWebEnv, getWebEnv } from './env';

const db = getDb();
assertProductionWebEnv();
const env = getWebEnv();

const defaultDevEmailConfig = {
  server: 'smtp://localhost:1025',
  from: 'Beacon <no-reply@localhost>'
};

function getEmailProviderConfig() {
  const server = env.AUTH_EMAIL_SERVER;
  const from = env.AUTH_EMAIL_FROM;

  if (server && from) {
    return { server, from };
  }

  return defaultDevEmailConfig;
}

export const authConfig = {
  trustHost: env.AUTH_TRUST_HOST === 'true' || env.NODE_ENV !== 'production',
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens
  }),
  session: {
    strategy: 'database'
  },
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID ?? 'dev-google-client-id',
      clientSecret: env.AUTH_GOOGLE_SECRET ?? 'dev-google-client-secret'
    }),
    Nodemailer(getEmailProviderConfig())
  ],
  pages: {
    signIn: '/login',
    verifyRequest: '/login'
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        (session.user as { id?: string }).id = user.id;
      }
      return session;
    }
  }
} satisfies NextAuthConfig;
