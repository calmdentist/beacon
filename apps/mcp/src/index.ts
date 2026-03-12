import express from 'express';

import { env } from './lib/env.js';
import { toolsRouter } from './routes/tools.js';

const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'beacon-mcp' });
});

app.use('/tools', toolsRouter);

app.listen(env.MCP_PORT, () => {
  console.log(`Beacon MCP server listening on port ${env.MCP_PORT}`);
});
