import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, request, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';
import { newSid } from '../../packages/share-protocol/src/sid';
import { signToken, type Claims } from '../../packages/share-protocol/src/token';
import { VISIT_COOKIE } from '../../packages/share-protocol/src/visitor';
import { shareClient, type ShareClient } from '../../inspect/src/host/share/client';
import { shareHost, type ShareApi } from '../../inspect/src/host/share/share-host';
import { SOCKET_PATH, ToHost, ToView } from '../../inspect/src/messages';
import { MAX_VISITORS } from '../src/limits';

const SECRET = 'e2e-secret';
const WEB_ORIGIN = 'http://web.test';
const LOOPBACK = '127.0.0.1';
const HOUR_S = 3600;
const BOOT_MS = 60_000;
const WAIT_MS = 5000;
const HTTP_OK = 200;
const HTTP_FOUND = 302;
const HTTP_UNAVAILABLE = 503;

const nowS = () => Math.floor(Date.now() / 1000);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, LOOPBACK, resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

const listening = (server: Server) => new Promise<number>((resolve) => server.listen(0, LOOPBACK, () => resolve((server.address() as AddressInfo).port)));

function localEditor() {
  const server = createServer((_req, res) => res.end('editor'));
  const sockets = new WebSocketServer({ server, path: SOCKET_PATH });
  sockets.on('connection', (socket) => socket.on('message', (data, isBinary) => socket.send(isBinary ? data : `editor-got:${data}`)));
  return server;
}

function localApp() {
  const server = createServer((req, res) => res.end(`app:${req.url}`));
  const sockets = new WebSocketServer({ server, path: '/echo' });
  sockets.on('connection', (socket) => socket.on('message', (data) => socket.send(`echo:${data}`)));
  return server;
}

type Relay = { port: number; stop: () => void };

async function bootRelay(): Promise<Relay> {
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

const token = (sid: string, role: Claims['role'], sub = 'user-1', name = 'Ada') => signToken({ sid, role, sub, org: 'org-1', exp: nowS() + HOUR_S, name }, SECRET);

type Reply = { status: number; headers: IncomingMessage['headers']; body: string };

function get(relay: Relay, sid: string, path: string, headers: Record<string, string> = {}): Promise<Reply> {
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

const cookieOf = async (sid: string, role: Claims['role'], sub?: string) => `${VISIT_COOKIE}=${await token(sid, role, sub)}`;

type Visitor = { socket: WebSocket; inbox: string[] };

async function openVisitor(relay: Relay, sid: string, path: string, cookie: string): Promise<Visitor> {
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

async function until<T>(read: () => T | undefined): Promise<T> {
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

async function replyWhere(read: () => Promise<Reply>, status: number): Promise<Reply> {
  const deadline = Date.now() + WAIT_MS;
  let reply = await read();
  while (reply.status !== status && Date.now() < deadline) {
    await sleep(50);
    reply = await read();
  }
  return reply;
}

describe('the real host client through the real relay', () => {
  let relay: Relay;
  let app: Server;
  let editor: Server;
  let host: ShareClient;
  const sid = newSid();

  beforeAll(async () => {
    relay = await bootRelay();
    app = localApp();
    editor = localEditor();
    const [appPort, editorPort] = await Promise.all([listening(app), listening(editor)]);
    host = shareClient({
      relayUrl: `ws://${LOOPBACK}:${relay.port}/host`,
      hostToken: await token(sid, 'host', 'host-1', 'Host'),
      editorUrl: `http://${LOOPBACK}:${editorPort}`,
      appUrl: `http://${LOOPBACK}:${appPort}`,
      visitorOrigin: `http://${sid}.localhost:${relay.port}`
    });
    await host.ready;
  }, BOOT_MS + WAIT_MS);

  afterAll(() => {
    host?.close();
    relay?.stop();
    app?.close();
    editor?.close();
  });

  it('sends a visitor without a cookie to the web login and back with a cookie', async () => {
    const bare = await get(relay, sid, '/hello?a=1');
    expect(bare.status).toBe(HTTP_FOUND);
    expect(bare.headers.location).toBe(`${WEB_ORIGIN}/s/${sid}?next=${encodeURIComponent('/hello?a=1')}`);

    const signed = await token(sid, 'viewer');
    const auth = await get(relay, sid, `/__feega/auth?token=${signed}&next=${encodeURIComponent('/hello')}`);
    expect(auth.status).toBe(HTTP_FOUND);
    expect(auth.headers.location).toBe('/hello');
    const cookie = String(auth.headers['set-cookie']).split(';')[0];

    const page = await get(relay, sid, '/hello', { cookie });
    expect(page.status).toBe(HTTP_OK);
    expect(page.body).toBe('app:/hello');
  });

  it('refuses a token signed for another session', async () => {
    const wrong = await token(newSid(), 'viewer');

    const response = await get(relay, sid, `/__feega/auth?token=${wrong}`);

    expect(response.status).toBe(403);
  });

  it('proxies http to the app', async () => {
    const response = await get(relay, sid, '/page?x=1', { cookie: await cookieOf(sid, 'viewer') });

    expect(response.status).toBe(HTTP_OK);
    expect(response.body).toBe('app:/page?x=1');
  });

  it('proxies a websocket to the app', async () => {
    const visitor = await openVisitor(relay, sid, '/echo', await cookieOf(sid, 'viewer', 'ws-user'));

    visitor.socket.send('ping');

    expect(await until(() => visitor.inbox[0])).toBe('echo:ping');
    visitor.socket.terminate();
  });

  it('rejects an edit from a viewer and lets an editor through', async () => {
    const edit = JSON.stringify({ kind: ToHost.Edit, ask: { at: 'src/a.tsx:1:1' } });
    const viewer = await openVisitor(relay, sid, SOCKET_PATH, await cookieOf(sid, 'viewer', 'viewer-1'));
    const editorVisitor = await openVisitor(relay, sid, SOCKET_PATH, await cookieOf(sid, 'editor', 'editor-1'));

    viewer.socket.send(edit);
    editorVisitor.socket.send(edit);

    const refusal = JSON.parse(await until(() => viewer.inbox[0]));
    expect(refusal).toMatchObject({ kind: ToView.Edited, ok: false, reason: 'viewers cannot edit' });
    expect(await until(() => editorVisitor.inbox[0])).toBe(`editor-got:${edit}`);
    expect(viewer.inbox).toHaveLength(1);
    viewer.socket.terminate();
    editorVisitor.socket.terminate();
  });

  it('lets the host promote a viewer, on the open socket and on a new one, and demote again', async () => {
    const edit = JSON.stringify({ kind: ToHost.Edit, ask: { at: 'src/b.tsx:2:2' } });
    const cookie = await cookieOf(sid, 'viewer', 'promoted');
    const before = await openVisitor(relay, sid, SOCKET_PATH, cookie);

    before.socket.send(edit);
    expect(JSON.parse(await until(() => before.inbox[0]))).toMatchObject({ ok: false, reason: 'viewers cannot edit' });

    host.setRole('promoted', 'editor');
    await until(() => host.visitors().find((v) => v.userId === 'promoted' && v.role === 'editor'));
    const after = await openVisitor(relay, sid, SOCKET_PATH, cookie);
    before.socket.send(edit);
    after.socket.send(edit);

    expect(await until(() => before.inbox[1])).toBe(`editor-got:${edit}`);
    expect(await until(() => after.inbox[0])).toBe(`editor-got:${edit}`);

    host.setRole('promoted', 'viewer');
    await until(() => host.visitors().find((v) => v.userId === 'promoted' && v.role === 'viewer'));
    after.socket.send(edit);

    expect(JSON.parse(await until(() => after.inbox[1]))).toMatchObject({ ok: false, reason: 'viewers cannot edit' });
    before.socket.terminate();
    after.socket.terminate();
  });

  it('refuses the visitor over the limit', async () => {
    const seated: Visitor[] = [];
    for (let i = 0; i < MAX_VISITORS; i++) {
      seated.push(await openVisitor(relay, sid, '/echo', await cookieOf(sid, 'viewer', `crowd-${i}`)));
    }

    const extra = await openVisitor(relay, sid, '/echo', await cookieOf(sid, 'viewer', 'crowd-extra')).catch((failure: Error) => failure);
    const http = await get(relay, sid, '/page', { cookie: await cookieOf(sid, 'viewer', 'crowd-extra') });

    expect(extra).toBeInstanceOf(Error);
    expect((extra as Error).message).toBe(`refused ${HTTP_UNAVAILABLE}`);
    expect(http.status).toBe(HTTP_UNAVAILABLE);
    seated.forEach((visitor) => visitor.socket.terminate());
  });
});

describe('a session the host stopped', () => {
  let relay: Relay;
  let app: Server;
  let editor: Server;
  const sid = newSid();

  beforeAll(async () => {
    relay = await bootRelay();
    app = localApp();
    editor = localEditor();
    await Promise.all([listening(app), listening(editor)]);
  }, BOOT_MS);

  afterAll(() => {
    relay?.stop();
    app?.close();
    editor?.close();
  });

  const hostFor = async (id: string) =>
    shareClient({
      relayUrl: `ws://${LOOPBACK}:${relay.port}/host`,
      hostToken: await token(id, 'host', 'host-1', 'Host'),
      editorUrl: `http://${LOOPBACK}:${(editor.address() as AddressInfo).port}`,
      appUrl: `http://${LOOPBACK}:${(app.address() as AddressInfo).port}`,
      visitorOrigin: `http://${id}.localhost:${relay.port}`
    });

  it('sends every visitor to the snapshot page once the host stopped', async () => {
    const stopped = await hostFor(sid);
    await stopped.ready;
    const cookie = await cookieOf(sid, 'viewer');
    expect((await get(relay, sid, '/page', { cookie })).status).toBe(HTTP_OK);

    stopped.close();

    const redirected = await replyWhere(() => get(relay, sid, '/page', { cookie }), HTTP_FOUND);
    expect(redirected.headers.location).toBe(`${WEB_ORIGIN}/s/${sid}`);
    const deep = await get(relay, sid, '/a/b?c=1', { cookie });
    expect(deep.headers.location).toBe(`${WEB_ORIGIN}/s/${sid}`);
  });
});

describe('a share started and stopped through the host and the sessions API', () => {
  let relay: Relay;
  let app: Server;
  let editor: Server;
  const sid = newSid();

  beforeAll(async () => {
    relay = await bootRelay();
    app = localApp();
    editor = localEditor();
    await Promise.all([listening(app), listening(editor)]);
  }, BOOT_MS);

  afterAll(() => {
    relay?.stop();
    app?.close();
    editor?.close();
  });

  const sessionsApi = (closed: string[]): ShareApi => ({
    startSession: async () => ({ id: sid, url: `http://${sid}.localhost:${relay.port}`, hostToken: await token(sid, 'host', 'host-1', 'Host'), expiresAt: new Date(Date.now() + HOUR_S * 1000).toISOString() }),
    closeSession: async (id) => (closed.push(id), { snapshotUploadUrl: '' }),
    setMember: async () => undefined
  });

  it('serves the link while shared and sends visitors to the session page once stopped', async () => {
    const closed: string[] = [];
    const share = shareHost({ api: sessionsApi(closed), relayUrl: `ws://${LOOPBACK}:${relay.port}/host`, send: fetch });

    const info = await share.start({
      dir: '/work/landing',
      editorUrl: `http://${LOOPBACK}:${(editor.address() as AddressInfo).port}`,
      appUrl: `http://${LOOPBACK}:${(app.address() as AddressInfo).port}`,
      visitorsCanEdit: false
    });
    const cookie = await cookieOf(info.id, 'viewer');
    expect((await get(relay, info.id, '/page', { cookie })).status).toBe(HTTP_OK);

    await share.stop(info.id);

    const redirected = await replyWhere(() => get(relay, info.id, '/page', { cookie }), HTTP_FOUND);
    expect(redirected.headers.location).toBe(`${WEB_ORIGIN}/s/${info.id}`);
    expect(closed).toEqual([info.id]);
  });
});
