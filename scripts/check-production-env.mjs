#!/usr/bin/env node

const REQUIRED_WEB = [
  'NEXT_PUBLIC_APP_URL',
  'DATABASE_URL',
  'NEON_AUTH_BASE_URL',
  'NEON_AUTH_COOKIE_SECRET',
  'BEACON_API_TOKEN',
  'OPENAI_API_KEY',
  'EMBEDDING_MODEL',
  'EMBEDDING_DIMENSIONS'
];

const REQUIRED_MCP = [
  'BEACON_API_URL',
  'BEACON_API_TOKEN'
];

const missing = [];
const placeholders = [];

for (const key of [...REQUIRED_WEB, ...REQUIRED_MCP]) {
  const value = process.env[key];

  if (!value || value.trim().length === 0) {
    missing.push(key);
    continue;
  }

  if (value.trim().includes('replace-me')) {
    placeholders.push(key);
  }
}

if ((process.env.NEON_AUTH_COOKIE_SECRET ?? '').trim().length < 32) {
  placeholders.push('NEON_AUTH_COOKIE_SECRET (must be at least 32 chars)');
}

if (missing.length === 0 && placeholders.length === 0) {
  console.log('Production env check passed.');
  process.exit(0);
}

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
}

if (placeholders.length > 0) {
  console.error(`Invalid placeholder env vars: ${placeholders.join(', ')}`);
}

process.exit(1);
