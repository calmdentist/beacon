import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createAuthMiddleware } from './lib/auth.js';
import { env } from './lib/env.js';
import { createBeaconMcpServer } from './lib/mcp-server.js';

type SessionRuntime = {
  transport: StreamableHTTPServerTransport;
  server: ReturnType<typeof createBeaconMcpServer>;
  closed: boolean;
};

const sessions = new Map<string, SessionRuntime>();

const app = createMcpExpressApp({
  host: '0.0.0.0',
  allowedHosts: env.allowedHosts.length > 0 ? env.allowedHosts : undefined
});

const { authMiddleware, authMetadataRouter } = createAuthMiddleware();

if (authMetadataRouter) {
  app.use(authMetadataRouter);
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'beacon-mcp',
    authMode: env.authMode
  });
});

const handleMcpPost = async (
  req: Request,
  res: Response
) => {
  const sessionId = firstHeader(req.headers['mcp-session-id']);

  try {
    if (sessionId) {
      const runtime = sessions.get(sessionId);
      if (!runtime) {
        res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Unknown MCP session.' },
          id: null
        });
        return;
      }

      await runtime.transport.handleRequest(req, res, req.body);
      return;
    }

    const runtime = await createSessionRuntime();
    await runtime.transport.handleRequest(req, res, req.body);

    if (!runtime.transport.sessionId) {
      // Non-initialize requests without an MCP session should not keep resources open.
      await closeSessionRuntime(runtime);
    }
  } catch (error) {
    console.error('Error handling MCP POST request', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  }
};

const handleMcpGet = async (
  req: Request,
  res: Response
) => {
  const sessionId = firstHeader(req.headers['mcp-session-id']);
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).send('Invalid or missing MCP session ID.');
    return;
  }

  const runtime = sessions.get(sessionId);
  if (!runtime) {
    res.status(400).send('Invalid or missing MCP session ID.');
    return;
  }

  try {
    await runtime.transport.handleRequest(req, res);
  } catch (error) {
    console.error('Error handling MCP GET request', error);
    if (!res.headersSent) {
      res.status(500).send('Failed to establish MCP stream.');
    }
  }
};

const handleMcpDelete = async (
  req: Request,
  res: Response
) => {
  const sessionId = firstHeader(req.headers['mcp-session-id']);
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).send('Invalid or missing MCP session ID.');
    return;
  }

  const runtime = sessions.get(sessionId);
  if (!runtime) {
    res.status(400).send('Invalid or missing MCP session ID.');
    return;
  }

  try {
    await runtime.transport.handleRequest(req, res);
    await closeSessionRuntime(runtime);
  } catch (error) {
    console.error('Error handling MCP DELETE request', error);
    if (!res.headersSent) {
      res.status(500).send('Failed to terminate MCP session.');
    }
  }
};

if (authMiddleware) {
  app.post('/mcp', authMiddleware, handleMcpPost);
  app.get('/mcp', authMiddleware, handleMcpGet);
  app.delete('/mcp', authMiddleware, handleMcpDelete);
} else {
  app.post('/mcp', handleMcpPost);
  app.get('/mcp', handleMcpGet);
  app.delete('/mcp', handleMcpDelete);
}

app.listen(env.MCP_PORT, () => {
  console.log(`Beacon MCP server listening on port ${env.MCP_PORT}`);
  console.log(`MCP endpoint: ${env.mcpServerUrl}`);
  console.log(`Auth mode: ${env.authMode}`);
});

process.on('SIGINT', async () => {
  const runtimes = [...sessions.values()];
  await Promise.all(runtimes.map((runtime) => closeSessionRuntime(runtime)));
  process.exit(0);
});

async function createSessionRuntime(): Promise<SessionRuntime> {
  const server = createBeaconMcpServer();

  const runtime: SessionRuntime = {
    transport: new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        sessions.set(sessionId, runtime);
      }
    }),
    server,
    closed: false
  };

  runtime.transport.onclose = () => {
    void closeSessionRuntime(runtime, { transportAlreadyClosed: true });
  };

  await server.connect(runtime.transport);
  return runtime;
}

async function closeSessionRuntime(
  runtime: SessionRuntime,
  options: { transportAlreadyClosed?: boolean } = {}
): Promise<void> {
  if (runtime.closed) {
    return;
  }

  runtime.closed = true;

  if (runtime.transport.sessionId) {
    sessions.delete(runtime.transport.sessionId);
  }

  if (!options.transportAlreadyClosed) {
    await runtime.transport.close().catch((error) => {
      console.warn('Failed to close MCP transport', error);
    });
  }

  await runtime.server.close().catch((error) => {
    console.warn('Failed to close MCP server', error);
  });
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
