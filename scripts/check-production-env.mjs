#!/usr/bin/env node

const REQUIRED_WEB = [
  'NEXT_PUBLIC_APP_URL',
  'DATABASE_URL',
  'AUTH_SECRET',
  'AUTH_GOOGLE_ID',
  'AUTH_GOOGLE_SECRET',
  'AUTH_EMAIL_SERVER',
  'AUTH_EMAIL_FROM',
  'AUTH_TRUST_HOST',
  'BEACON_API_TOKEN',
  'OPENAI_API_KEY',
  'EMBEDDING_MODEL',
  'EMBEDDING_DIMENSIONS'
];

const REQUIRED_MCP = [
  'BEACON_API_URL',
  'BEACON_API_TOKEN'
];

const PLACEHOLDER_VALUES = new Set(['replace-me']);

const missing = [];
const placeholders = [];

for (const key of [...REQUIRED_WEB, ...REQUIRED_MCP]) {
  const value = process.env[key];

  if (!value || value.trim().length === 0) {
    missing.push(key);
    continue;
  }

  if (PLACEHOLDER_VALUES.has(value.trim())) {
    placeholders.push(key);
  }
}

if (!process.env.AUTH_EMAIL_SERVER?.startsWith('smtp://')) {
  placeholders.push('AUTH_EMAIL_SERVER (must be smtp://...)');
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
