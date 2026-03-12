import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { getCurrentUserId } from '@/lib/auth';
import { unauthorizedIfNeeded } from '@/lib/http';
import { acceptIntroRequestForUser } from '@/lib/store';

interface RouteProps {
  params: Promise<{ id: string }>;
}

const idSchema = z.string().uuid();

export async function POST(_: Request, { params }: RouteProps) {
  try {
    const { id: rawId } = await params;
    const id = idSchema.parse(rawId);
    const userId = await getCurrentUserId();

    const intro = await acceptIntroRequestForUser(userId, id);

    if (!intro) {
      return NextResponse.json({ error: 'Intro request not found' }, { status: 404 });
    }

    return NextResponse.json(intro);
  } catch (error) {
    const unauthorized = unauthorizedIfNeeded(error);
    if (unauthorized) {
      return unauthorized;
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid intro request id' }, { status: 400 });
    }

    console.error('Failed to accept intro request', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
