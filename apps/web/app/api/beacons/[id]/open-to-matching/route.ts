import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { getCurrentUserId } from '@/lib/auth';
import { unauthorizedIfNeeded } from '@/lib/http';
import { setBeaconMatchingForUser } from '@/lib/store';

const payloadSchema = z.object({
  isMatchable: z.boolean()
});
const idSchema = z.string().uuid();

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const { id: rawId } = await params;
    const id = idSchema.parse(rawId);
    const userId = await getCurrentUserId();
    const body = await request.json();
    const payload = payloadSchema.parse(body);

    const beacon = await setBeaconMatchingForUser(userId, id, payload.isMatchable);

    if (!beacon) {
      return NextResponse.json({ error: 'Beacon not found' }, { status: 404 });
    }

    return NextResponse.json(beacon);
  } catch (error) {
    const unauthorized = unauthorizedIfNeeded(error);
    if (unauthorized) {
      return unauthorized;
    }

    if (error instanceof SyntaxError || error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    console.error('Failed to update matching settings', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
