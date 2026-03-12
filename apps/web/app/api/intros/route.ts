import { NextResponse } from 'next/server';

import { getCurrentUserId } from '@/lib/auth';
import { unauthorizedIfNeeded } from '@/lib/http';
import { listIntrosForUser } from '@/lib/store';

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const intros = await listIntrosForUser(userId);
    return NextResponse.json(intros);
  } catch (error) {
    const unauthorized = unauthorizedIfNeeded(error);
    if (unauthorized) {
      return unauthorized;
    }

    console.error('Failed to list intro requests', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
