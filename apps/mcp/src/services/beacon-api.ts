import {
  mcpCreateDraftRequestSchema,
  mcpCreateDraftResponseSchema,
  type BeaconDraft
} from '@beacon/core';

import { env } from '../lib/env.js';

export async function createBeaconDraft(payload: unknown, userId: string): Promise<BeaconDraft> {
  const input = mcpCreateDraftRequestSchema.parse(payload);

  const response = await fetch(`${env.BEACON_API_URL}/api/mcp/drafts`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.BEACON_API_TOKEN}`,
      'x-beacon-user-id': userId
    },
    body: JSON.stringify({
      title: input.title,
      summary: input.summary,
      conversationContext: input.conversationContext,
      sourceLlm: input.sourceLlm
    })
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`Beacon API rejected draft request (${response.status}): ${reason}`);
  }

  const data = await response.json();
  return mcpCreateDraftResponseSchema.parse(data);
}
