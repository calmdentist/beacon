import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { getCurrentUserId } from '@/lib/auth';
import { unauthorizedIfNeeded } from '@/lib/http';
import { getBeaconForUser, getRelatedForBeacon } from '@/lib/store';

interface RouteProps {
  params: Promise<{ id: string }>;
}

const idSchema = z.string().uuid();

export async function GET(_: Request, { params }: RouteProps) {
  try {
    const { id: rawId } = await params;
    const id = idSchema.parse(rawId);
    const userId = await getCurrentUserId();

    const beacon = await getBeaconForUser(userId, id);
    if (!beacon) {
      return NextResponse.json({ error: 'Beacon not found' }, { status: 404 });
    }

    const related = await getRelatedForBeacon(userId, id);
    return NextResponse.json(related);
  } catch (error) {
    const unauthorized = unauthorizedIfNeeded(error);
    if (unauthorized) {
      return unauthorized;
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid beacon id' }, { status: 400 });
    }

    console.error('Failed to load related beacons', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
