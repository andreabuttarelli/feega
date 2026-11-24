import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import type { ChangeRow } from '../../messages';

const HOST = '127.0.0.1';
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const TOKEN_BYTES = 24;

export type BridgeState = { selection: () => string | null; changes: () => ChangeRow[] };

export type Bridge = { host: string; port: number; token: string; close: () => Promise<void> };

const sameToken = (given: string, token: string) => given.length === token.length && timingSafeEqual(Buffer.from(given), Buffer.from(token));

const bearerOf = (request: IncomingMessage) => (request.headers.authorization ?? '').replace(/^Bearer /, '');

export async function startBridge(state: BridgeState): Promise<Bridge> {
  const token = randomBytes(TOKEN_BYTES).toString('hex');
  const routes: Record<string, () => unknown> = {
    '/selection': () => ({ context: state.selection() }),
    '/changes': () => ({ changes: state.changes() })
  };

  const server = createServer((request, response) => {
    if (!sameToken(bearerOf(request), token)) {
      response.writeHead(HTTP_UNAUTHORIZED).end();
      return;
    }
    const route = routes[new URL(request.url ?? '/', 'http://x').pathname];
    if (!route) {
      response.writeHead(HTTP_NOT_FOUND).end();
      return;
    }
    response.writeHead(HTTP_OK, { 'content-type': 'application/json' }).end(JSON.stringify(route()));
  });

  await new Promise<void>((resolve, reject) => server.once('error', reject).listen(0, HOST, resolve));
  const port = (server.address() as { port: number }).port;

  const close = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });

  return { host: HOST, port, token, close };
}
