import { Router } from 'express';

import { mcpCreateDraftRequestSchema } from '@beacon/core';

import { createBeaconDraft } from '../services/beacon-api.js';

export const toolsRouter = Router();

toolsRouter.post('/create_beacon_from_context', async (req, res) => {
  try {
    const payload = mcpCreateDraftRequestSchema.parse(req.body);
    const draft = await createBeaconDraft(payload);

    return res.status(201).json({
      tool: 'create_beacon_from_context',
      result: draft
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected MCP error';
    return res.status(400).json({ error: message });
  }
});
