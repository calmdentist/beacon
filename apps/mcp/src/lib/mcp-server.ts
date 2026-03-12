import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mcpCreateDraftRequestSchema } from '@beacon/core';
import * as z from 'zod';

import { createBeaconDraft } from '../services/beacon-api.js';
import { resolveUserIdFromAuth } from './auth.js';

const createBeaconFromContextInputSchema = {
  title: z.string().max(160).optional(),
  summary: z.string().max(1200).optional(),
  conversationContext: z.string().min(1),
  sourceLlm: z.string().max(64).optional()
};

export function createBeaconMcpServer() {
  const server = new McpServer({
    name: 'beacon-mcp',
    version: '0.2.0'
  });

  server.registerTool(
    'create_beacon_from_context',
    {
      title: 'Beacon This',
      description: 'Create a Beacon draft from the current conversation context.',
      inputSchema: createBeaconFromContextInputSchema
    },
    async (args, extra) => {
      const payload = mcpCreateDraftRequestSchema.parse(args);
      const userId = resolveUserIdFromAuth(extra.authInfo);
      const draft = await createBeaconDraft(payload, userId);

      return {
        content: [
          {
            type: 'text',
            text: `Draft created. Review it here: ${draft.reviewUrl}`
          }
        ],
        structuredContent: draft
      };
    }
  );

  return server;
}
