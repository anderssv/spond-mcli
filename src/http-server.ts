import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SpondMcpServer } from './mcp-server.js';
import { extractBearerToken } from './http-auth.js';
import { buildSpondClient } from './client-factory.js';
import { validateSpondToken } from './token-config.js';
import { getOrCreateTokenWorkspaceDir, sweepStaleWorkspaces, getWorkspaceRoot, WORKSPACE_TTL_ENV } from './workspace-manager.js';

const SWEEP_INTERVAL_MS = 1000 * 60 * 60;
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = extractBearerToken(req.headers['authorization']);
  if (!token) {
    sendJson(res, 401, {
      error: 'Missing Authorization: Bearer <token> header. Run "spond-mcli login" locally to obtain a token, then set that value in your MCP client\'s config.'
    });
    return;
  }

  const validation = validateSpondToken(token);
  if (!validation.isValid) {
    sendJson(res, 401, { error: `Invalid token: ${validation.error}` });
    return;
  }

  const client = buildSpondClient(token);
  const workspaceDir = await getOrCreateTokenWorkspaceDir(token);
  const mcpServer = new SpondMcpServer(client, workspaceDir);
  // Stateless mode: each request gets its own transport/server pair, scoped
  // to the token in that request's Authorization header. No session state is
  // kept between requests.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => {
    transport.close();
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res);
}

function createRequestListener() {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }

    if (url.pathname === '/mcp') {
      try {
        await handleMcpRequest(req, res);
      } catch (error) {
        console.error('HTTP MCP request failed:', error);
        if (!res.headersSent) {
          sendJson(res, 500, { error: 'Internal server error' });
        }
      }
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  };
}

export function startHttpServer(port: number): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer(createRequestListener());

    const ttlMs = Number(process.env[WORKSPACE_TTL_ENV]) || DEFAULT_TTL_MS;
    const sweepInterval = setInterval(() => {
      sweepStaleWorkspaces(getWorkspaceRoot(), ttlMs).catch(error => {
        console.error('Workspace sweep failed:', error);
      });
    }, SWEEP_INTERVAL_MS);
    sweepInterval.unref();
    server.on('close', () => clearInterval(sweepInterval));

    server.listen(port, () => {
      const address = server.address();
      const boundPort = address && typeof address !== 'string' ? address.port : port;
      console.error(`Spond MCLI HTTP server listening on port ${boundPort}`);
      resolve(server);
    });
  });
}
