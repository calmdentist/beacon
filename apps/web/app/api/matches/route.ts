import { NextResponse } from 'next/server';

import { getCurrentUserId } from '@/lib/auth';
import { unauthorizedIfNeeded } from '@/lib/http';
import { listMatchesForUser } from '@/lib/store';

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const matches = await listMatchesForUser(userId);
    return NextResponse.json(matches);
  } catch (error) {
    const unauthorized = unauthorizedIfNeeded(error);
    if (unauthorized) {
      return unauthorized;
    }

    console.error('Failed to list matches', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
