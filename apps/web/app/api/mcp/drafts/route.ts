import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { mcpCreateDraftRequestSchema } from '@beacon/core';
import { draftBeaconFromContext } from '@beacon/ai';
import { getDb, schema } from '@beacon/db';
import { eq } from 'drizzle-orm';

import { getWebEnv } from '@/lib/env';
import { createBeaconForUser } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const env = getWebEnv();
    const authHeader = request.headers.get('authorization');

    if (env.NODE_ENV === 'production' && env.BEACON_API_TOKEN === 'replace-me') {
      return NextResponse.json({ error: 'Server misconfigured: BEACON_API_TOKEN' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${env.BEACON_API_TOKEN}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const payload = mcpCreateDraftRequestSchema.parse(body);

    const db = getDb();
    const [user] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, payload.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'Unknown userId for draft creation' }, { status: 404 });
    }

    const appUrl = env.NEXT_PUBLIC_APP_URL;
    const generated = draftBeaconFromContext(payload, `${appUrl}/dashboard`);
    const savedDraft = await createBeaconForUser(payload.userId, {
      title: generated.title,
      summary: generated.summary,
      exploring: generated.exploring,
      helpWanted: generated.helpWanted,
      tags: generated.tags,
      sourceLlm: payload.sourceLlm,
      sourceType: 'mcp',
      status: 'draft',
      isMatchable: false
    });

    return NextResponse.json(
      {
        draftId: savedDraft.id,
        title: savedDraft.title,
        summary: savedDraft.summary,
        exploring: savedDraft.exploring,
        helpWanted: savedDraft.helpWanted,
        tags: savedDraft.tags,
        suggestedMatchable: generated.suggestedMatchable,
        reviewUrl: `${appUrl}/beacons/${savedDraft.id}/review`
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    console.error('Failed to create MCP draft', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
