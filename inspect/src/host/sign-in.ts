import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { accountOfBody, type Account } from './account';

export const APP_URL = 'https://oh.feega.app';
export const SIGN_IN_TIMEOUT_MS = 5 * 60_000;

const LOOPBACK = '127.0.0.1';
const STATE_PREFIX = 'app.';
const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

export enum SignInEnd {
  Done = 'done',
  Timeout = 'timeout',
  Cancelled = 'cancelled'
}

export type SignInOutcome = { end: SignInEnd.Done; account: Account } | { end: SignInEnd.Timeout | SignInEnd.Cancelled };

export type SignInDeps = {
  appUrl?: string;
  openBrowser: (url: string) => unknown;
  signal: AbortSignal;
  timeoutMs?: number;
  newState?: () => string;
};

const readBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
};

const reply = (res: ServerResponse, status: number, origin: string, text = '') => {
  res.writeHead(status, {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    'access-control-allow-private-network': 'true'
  });
  res.end(text);
};

export async function signIn({ appUrl = APP_URL, openBrowser, signal, timeoutMs = SIGN_IN_TIMEOUT_MS, newState = () => `${STATE_PREFIX}${randomUUID()}` }: SignInDeps): Promise<SignInOutcome> {
  const state = newState();
  const origin = new URL(appUrl).origin;
  const accepted = Promise.withResolvers<Account>();

  const server = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      return reply(res, HTTP_NO_CONTENT, origin);
    }
    if (req.method !== 'POST' || req.url !== '/session') {
      return reply(res, HTTP_NOT_FOUND, origin);
    }
    const body = await readBody(req);
    const account = body.state === state ? accountOfBody(body) : null;
    if (!account) {
      return reply(res, HTTP_BAD_REQUEST, origin, 'Invalid session');
    }
    reply(res, HTTP_OK, origin, 'OK');
    accepted.resolve(account);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, LOOPBACK, resolve);
  });

  const port = (server.address() as { port: number }).port;
  const callback = new URL('/cli/callback', appUrl);
  callback.search = new URLSearchParams({ cli_port: String(port), cli_state: state }).toString();

  const ended = Promise.withResolvers<SignInOutcome>();
  const timer = setTimeout(() => ended.resolve({ end: SignInEnd.Timeout }), timeoutMs);
  const onAbort = () => ended.resolve({ end: SignInEnd.Cancelled });
  signal.addEventListener('abort', onAbort, { once: true });
  void accepted.promise.then((account) => ended.resolve({ end: SignInEnd.Done, account }));
  if (signal.aborted) {
    onAbort();
  } else {
    await openBrowser(callback.toString());
  }

  try {
    return await ended.promise;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
