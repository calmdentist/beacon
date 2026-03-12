import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { getCurrentUserId } from '@/lib/auth';
import { unauthorizedIfNeeded } from '@/lib/http';
import { createBeaconForUser, listBeaconsForUser } from '@/lib/store';

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const beacons = await listBeaconsForUser(userId);
    return NextResponse.json(beacons);
  } catch (error) {
    const unauthorized = unauthorizedIfNeeded(error);
    if (unauthorized) {
      return unauthorized;
    }

    console.error('Failed to list beacons', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const payload = await request.json();
    const beacon = await createBeaconForUser(userId, payload);
    return NextResponse.json(beacon, { status: 201 });
  } catch (error) {
    const unauthorized = unauthorizedIfNeeded(error);
    if (unauthorized) {
      return unauthorized;
    }

    if (error instanceof SyntaxError || error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    console.error('Failed to create beacon', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
