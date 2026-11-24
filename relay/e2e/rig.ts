import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, request, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import WebSocket, { WebSocketServer } from 'ws';
import { signToken, type Claims } from '../../packages/share-protocol/src/token';
import { VISIT_COOKIE } from '../../packages/share-protocol/src/visitor';
import { SOCKET_PATH } from '../../inspect/src/messages';

export const SECRET = 'e2e-secret';
export const WEB_ORIGIN = 'http://web.test';
export const LOOPBACK = '127.0.0.1';
export const HOUR_S = 3600;
export const BOOT_MS = 60_000;
export const WAIT_MS = 5000;
export const HTTP_OK = 200;
export const HTTP_FOUND = 302;
export const HTTP_UNAVAILABLE = 503;

export const nowS = () => Math.floor(Date.now() / 1000);
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, LOOPBACK, resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

export const listening = (server: Server) => new Promise<number>((resolve) => server.listen(0, LOOPBACK, () => resolve((server.address() as AddressInfo).port)));

export function localEditor() {
  const server = createServer((_req, res) => res.end('editor'));
  const sockets = new WebSocketServer({ server, path: SOCKET_PATH });
  sockets.on('connection', (socket) => socket.on('message', (data, isBinary) => socket.send(isBinary ? data : `editor-got:${data}`)));
  return server;
}

export function localApp() {
  const server = createServer((req, res) => res.end(`app:${req.url}`));
  const sockets = new WebSocketServer({ server, path: '/echo' });
  sockets.on('connection', (socket) => socket.on('message', (data) => socket.send(`echo:${data}`)));
  return server;
}

export type Relay = { port: number; stop: () => void };

export async function bootRelay(): Promise<Relay> {
  const port = await freePort();
  const args = ['wrangler', 'dev', '--local', '--ip', LOOPBACK, '--port', String(port), '--inspector-port', '0', '--infer-origin-from-routes', 'false', '--var', `VISITOR_BASE:localhost:${port}`, '--var', `WEB_ORIGIN:${WEB_ORIGIN}`, '--var', `RELAY_SIGNING_SECRET:${SECRET}`];
  const child: ChildProcess = spawn('npx', args, { cwd: new URL('..', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'pipe'] });
  const log: string[] = [];
  child.stdout?.on('data', (chunk) => log.push(String(chunk)));
  child.stderr?.on('data', (chunk) => log.push(String(chunk)));
  const deadline = Date.now() + BOOT_MS;
  while (!log.join('').includes('Ready on') && Date.now() < deadline) {
    await sleep(200);
  }
  if (!log.join('').includes('Ready on')) {
    child.kill();
    throw new Error(`relay did not start:\n${log.join('')}`);
  }
  return { port, stop: () => child.kill('SIGTERM') };
}

export const token = (sid: string, role: Claims['role'], sub = 'user-1', name = 'Ada') => signToken({ sid, role, sub, org: 'org-1', exp: nowS() + HOUR_S, name }, SECRET);

export type Reply = { status: number; headers: IncomingMessage['headers']; body: string };

export function get(relay: Relay, sid: string, path: string, headers: Record<string, string> = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: LOOPBACK, port: relay.port, path, headers: { host: `${sid}.localhost:${relay.port}`, ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
}

export const cookieOf = async (sid: string, role: Claims['role'], sub?: string, name?: string) => `${VISIT_COOKIE}=${await token(sid, role, sub, name)}`;

export type Visitor = { socket: WebSocket; inbox: string[] };

export async function openVisitor(relay: Relay, sid: string, path: string, cookie: string): Promise<Visitor> {
  const socket = new WebSocket(`ws://${LOOPBACK}:${relay.port}${path}`, { headers: { host: `${sid}.localhost:${relay.port}`, cookie } });
  const inbox: string[] = [];
  socket.on('message', (data) => inbox.push(String(data)));
  await new Promise<void>((resolve, reject) => {
    socket.on('open', resolve);
    socket.on('unexpected-response', (_req, res) => reject(new Error(`refused ${res.statusCode}`)));
    socket.on('error', reject);
  });
  return { socket, inbox };
}

export async function until<T>(read: () => T | undefined): Promise<T> {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const value = read();
    if (value !== undefined) {
      return value;
    }
    await sleep(50);
  }
  throw new Error('timed out');
}

export async function replyWhere(read: () => Promise<Reply>, status: number): Promise<Reply> {
  const deadline = Date.now() + WAIT_MS;
  let reply = await read();
  while (reply.status !== status && Date.now() < deadline) {
    await sleep(50);
    reply = await read();
  }
  return reply;
}
