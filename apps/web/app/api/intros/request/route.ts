import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { getCurrentUserId } from '@/lib/auth';
import { unauthorizedIfNeeded } from '@/lib/http';
import { createIntroRequestForUser } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const payload = await request.json();
    const intro = await createIntroRequestForUser(userId, payload);
    return NextResponse.json(intro, { status: 201 });
  } catch (error) {
    const unauthorized = unauthorizedIfNeeded(error);
    if (unauthorized) {
      return unauthorized;
    }

    if (error instanceof SyntaxError || error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (error instanceof Error) {
      if (error.message === 'invalid_beacon_id') {
        return NextResponse.json({ error: 'Invalid beacon id' }, { status: 400 });
      }

      if (error.message === 'from_beacon_not_found' || error.message === 'to_beacon_not_found') {
        return NextResponse.json({ error: 'Beacon not found' }, { status: 404 });
      }

      if (error.message === 'to_user_mismatch') {
        return NextResponse.json({ error: 'Invalid intro target user' }, { status: 400 });
      }
    }

    console.error('Failed to create intro request', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
