import { NextResponse } from 'next/server';

import { UnauthorizedError } from './auth';

export function unauthorizedIfNeeded(error: unknown): NextResponse | null {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (isObjectWithStatus(error) && error.status === 401) {
    const message =
      typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : 'Authentication required';
    return NextResponse.json({ error: message }, { status: 401 });
  }

  return null;
}

function isObjectWithStatus(value: unknown): value is { status: number; message?: unknown } {
  return Boolean(value && typeof value === 'object' && 'status' in value);
}
