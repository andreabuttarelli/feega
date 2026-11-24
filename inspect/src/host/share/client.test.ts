import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer, type WebSocket } from 'ws';
import { FrameType, bytesFrame, decodeFrame, emptyFrame, encodeFrame, jsonFrame, jsonOf, textFrame, textOf, type Frame, type Present } from '../../../../packages/share-protocol/src/frame';
import { encodeVisitor } from '../../../../packages/share-protocol/src/visitor';
import { ToHost, ToView } from '../../messages';
import { shareClient, type ShareClient } from './client';

const WAIT_MS = 3000;
const ada = { userId: 'ada', name: 'Ada', role: 'editor' as const };
const vera = { userId: 'vera', name: 'Vera', role: 'viewer' as const };
const VISITOR_ORIGIN = 'https://abcdefghij.sessions.test';

const waitFor = async <T>(read: () => T | undefined | false, what = 'condition'): Promise<T> => {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const value = read();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timed out waiting for ${what}`);
};

const listen = (server: Server) => new Promise<number>((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)));

type Seen = { method?: string; url?: string; headers: IncomingMessage['headers']; body: string };

async function localServer(reply: (request: Seen, respond: (status: number, headers: Record<string, string | string[]>, body: string) => void) => void) {
  const seen: Seen[] = [];
  const sockets: { socket: WebSocket; messages: string[]; origin?: string; protocol: string }[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (c: Buffer) => chunks.push(c));
    request.on('end', () => {
      const entry = { method: request.method, url: request.url, headers: request.headers, body: Buffer.concat(chunks).toString() };
      seen.push(entry);
      reply(entry, (status, headers, body) => response.writeHead(status, headers).end(body));
    });
  });
  const wss = new WebSocketServer({ server, handleProtocols: (protocols) => [...protocols][0] ?? false });
  wss.on('connection', (socket, request) => {
    const entry = { socket, messages: [] as string[], origin: request.headers.origin, protocol: socket.protocol };
    sockets.push(entry);
    socket.on('message', (data) => entry.messages.push(String(data)));
  });
  const port = await listen(server);
  return { url: `http://127.0.0.1:${port}/`, seen, sockets, close: () => (wss.close(), server.closeAllConnections(), server.close()) };
}

async function fakeRelay() {
  const frames: Frame[] = [];
  let host: WebSocket | null = null;
  let connections = 0;
  let token = '';
  const server = createServer();
  const wss = new WebSocketServer({ server });
  wss.on('connection', (socket, request) => {
    connections += 1;
    host = socket;
    token = new URL(request.url ?? '', 'http://x').searchParams.get('token') ?? '';
    socket.on('message', (data: Buffer) => {
      const frame = decodeFrame(new Uint8Array(data));
      frame && frames.push(frame);
    });
  });
  const port = await listen(server);
  const send = (frame: Frame) => waitFor(() => host, 'host connection').then((socket) => socket.send(encodeFrame(frame)));
  const next = (match: (frame: Frame) => boolean) => waitFor(() => {
    const at = frames.findIndex(match);
    return at >= 0 && frames.splice(at, 1)[0];
  }, 'a frame');
  return { url: `ws://127.0.0.1:${port}/host`, frames, send, next, connections: () => connections, token: () => token, drop: (code = 1006) => host?.close(code === 1006 ? 1001 : code), close: () => (wss.close(), server.closeAllConnections(), server.close()) };
}

let cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).reverse().forEach((fn) => fn());
});

async function rig(options: { visitorsCanEdit?: boolean; appUrl?: string | null; sleep?: (ms: number) => Promise<void>; onPresence?: (v: Present[]) => void; onEnded?: (why: string) => void } = {}) {
  const editor = await localServer((request, respond) => respond(200, { 'content-type': 'text/html' }, `<h1>editor ${request.url}</h1>`));
  const app = await localServer((request, respond) => respond(200, { 'content-type': 'text/plain', 'set-cookie': ['a=1', 'b=2'] }, `app ${request.method} ${request.url} ${request.body}`));
  const relay = await fakeRelay();
  const client: ShareClient = shareClient({ relayUrl: relay.url, hostToken: 'host-token', editorUrl: editor.url, appUrl: options.appUrl === null ? undefined : (options.appUrl ?? app.url), visitorOrigin: VISITOR_ORIGIN, sleep: options.sleep, onPresence: options.onPresence, onEnded: options.onEnded });
  cleanup.push(() => (client.close(), relay.close(), editor.close(), app.close()));
  await client.ready;
  return { editor, app, relay, client };
}

const reqHead = (id: number, path: string, headers: Record<string, string> = {}, method = 'GET') => jsonFrame(id, FrameType.ReqHead, { method, path, headers: { 'x-feega-visitor': encodeVisitor(ada), host: 'abcdefghij.sessions.test', ...headers } });

async function fetchVia(relay: Awaited<ReturnType<typeof fakeRelay>>, id: number, path: string, headers: Record<string, string> = {}) {
  await relay.send(reqHead(id, path, headers));
  await relay.send(emptyFrame(id, FrameType.ReqEnd));
  const head = jsonOf<{ status: number; headers: Record<string, string> }>(await relay.next((f) => f.streamId === id && f.type === FrameType.ResHead))!;
  let body = '';
  for (;;) {
    const frame = await relay.next((f) => f.streamId === id && (f.type === FrameType.ResBody || f.type === FrameType.ResEnd));
    if (frame.type === FrameType.ResEnd) {
      return { ...head, body };
    }
    body += textOf(frame.payload);
  }
}

describe('shareClient', () => {
  it('connects with the host token', async () => {
    const { relay } = await rig();

    expect(relay.token()).toBe('host-token');
  });

  it('serves the editor page for a top level visit and the app for everything else', async () => {
    const { relay } = await rig();

    expect((await fetchVia(relay, 1, '/', { 'sec-fetch-dest': 'document' })).body).toBe('<h1>editor /</h1>');
    const app = await fetchVia(relay, 2, '/page?x=1', { 'sec-fetch-dest': 'iframe' });
    expect(app.body).toBe('app GET /page?x=1 ');
    expect(app.status).toBe(200);
    expect(app.headers['set-cookie']).toBe('a=1\nb=2');
  });

  it('presents itself to the local servers as the local origin and keeps the visitor away from the app', async () => {
    const { relay, app, editor } = await rig();

    await fetchVia(relay, 1, '/x', { origin: VISITOR_ORIGIN, referer: `${VISITOR_ORIGIN}/a`, cookie: 'k=v' });
    await fetchVia(relay, 2, '/panel.js');

    const seen = app.seen[0].headers;
    expect(seen.host).toBe(new URL(app.url).host);
    expect(seen.origin).toBe(new URL(app.url).origin);
    expect(seen.referer).toBe(`${new URL(app.url).origin}/a`);
    expect(seen['x-feega-visitor']).toBeUndefined();
    expect(seen.cookie).toBe('k=v');
    expect(editor.seen[0].headers['x-feega-visitor']).toBe(encodeVisitor(ada));
  });

  it('forwards a request body', async () => {
    const { relay } = await rig();

    await relay.send(reqHead(1, '/save', {}, 'POST'));
    await relay.send(bytesFrame(1, FrameType.ReqBody, new TextEncoder().encode('he')));
    await relay.send(bytesFrame(1, FrameType.ReqBody, new TextEncoder().encode('llo')));
    await relay.send(emptyFrame(1, FrameType.ReqEnd));

    await relay.next((f) => f.type === FrameType.ResHead);
    const body = await relay.next((f) => f.type === FrameType.ResBody);
    expect(textOf(body.payload)).toBe('app POST /save hello');
  });

  it('reports an error on the stream when the local server is down', async () => {
    const { relay, app } = await rig();
    app.close();

    await relay.send(reqHead(7, '/x'));
    await relay.send(emptyFrame(7, FrameType.ReqEnd));

    const error = await relay.next((f) => f.type === FrameType.Error && f.streamId === 7);
    expect(jsonOf<{ message: string }>(error)?.message).toBeTruthy();
  });

  it('reports an error when it does not know the app yet', async () => {
    const { relay } = await rig({ appUrl: null });

    await relay.send(reqHead(8, '/x'));
    await relay.send(emptyFrame(8, FrameType.ReqEnd));

    expect(jsonOf<{ message: string }>(await relay.next((f) => f.type === FrameType.Error && f.streamId === 8))?.message).toMatch(/app/i);
  });

  it('gives the editor channel to the editor server with the editor origin', async () => {
    const { relay, editor } = await rig();

    await relay.send(jsonFrame(3, FrameType.WsOpen, { path: '/feega-host', headers: { 'x-feega-visitor': encodeVisitor(ada) }, protocols: [] }));
    await relay.send(textFrame(3, JSON.stringify({ kind: ToHost.Ready })));

    const local = await waitFor(() => editor.sockets[0], 'local editor socket');
    await waitFor(() => local.messages[0], 'forwarded ready');
    expect(JSON.parse(local.messages[0])).toEqual({ kind: ToHost.Ready, by: { userId: 'ada', name: 'Ada' } });
    expect(local.origin).toBe(new URL(editor.url).origin);
  });

  it('rewrites the app address for the visitor and learns it', async () => {
    const { relay, editor } = await rig({ appUrl: null });
    await relay.send(jsonFrame(3, FrameType.WsOpen, { path: '/feega-host', headers: { 'x-feega-visitor': encodeVisitor(ada) }, protocols: [] }));
    const local = await waitFor(() => editor.sockets[0], 'local editor socket');

    local.socket.send(JSON.stringify({ kind: ToView.App, url: 'http://127.0.0.1:5999/', route: '/' }));
    const message = await relay.next((f) => f.type === FrameType.WsText && f.streamId === 3);

    expect(JSON.parse(textOf(message.payload)!)).toEqual({ kind: ToView.App, url: `${VISITOR_ORIGIN}/`, route: '/' });
  });

  it('sends other host messages to the visitor untouched', async () => {
    const { relay, editor } = await rig();
    await relay.send(jsonFrame(3, FrameType.WsOpen, { path: '/feega-host', headers: { 'x-feega-visitor': encodeVisitor(ada) }, protocols: [] }));
    const local = await waitFor(() => editor.sockets[0], 'local editor socket');

    local.socket.send(JSON.stringify({ kind: ToView.Status, text: 'hi' }));

    expect(JSON.parse(textOf((await relay.next((f) => f.type === FrameType.WsText)).payload)!)).toEqual({ kind: ToView.Status, text: 'hi' });
  });

  it('rejects an edit from a viewer, answers the viewer and keeps it from the editor', async () => {
    const { relay, editor } = await rig();
    await relay.send(jsonFrame(4, FrameType.WsOpen, { path: '/feega-host', headers: { 'x-feega-visitor': encodeVisitor(vera) }, protocols: [] }));
    const local = await waitFor(() => editor.sockets[0], 'local editor socket');

    await relay.send(textFrame(4, JSON.stringify({ kind: ToHost.Edit, ask: { at: 'a.svelte:1:1', prop: 'color', value: 'red' } })));
    await relay.send(textFrame(4, JSON.stringify({ kind: ToHost.Ready })));

    const answer = await relay.next((f) => f.type === FrameType.WsText && f.streamId === 4);
    expect(JSON.parse(textOf(answer.payload)!)).toEqual({ kind: ToView.Edited, ok: false, reason: 'viewers cannot edit' });
    await waitFor(() => local.messages.length > 0, 'ready');
    expect(local.messages.map((m) => JSON.parse(m).kind)).toEqual([ToHost.Ready]);
  });

  it('drops host only messages without telling the visitor', async () => {
    const { relay, editor } = await rig();
    await relay.send(jsonFrame(4, FrameType.WsOpen, { path: '/feega-host', headers: { 'x-feega-visitor': encodeVisitor(ada) }, protocols: [] }));
    await waitFor(() => editor.sockets[0], 'local editor socket');

    await relay.send(textFrame(4, JSON.stringify({ kind: ToHost.Prefs, prefs: {} })));
    await relay.send(textFrame(4, JSON.stringify({ kind: ToHost.Ready })));

    await waitFor(() => editor.sockets[0].messages.length > 0, 'ready');
    expect(editor.sockets[0].messages).toEqual([JSON.stringify({ kind: ToHost.Ready, by: { userId: 'ada', name: 'Ada' } })]);
    expect(relay.frames.filter((f) => f.type === FrameType.WsText)).toEqual([]);
  });

  it('lets an editor edit and locks the element against another editor', async () => {
    const { relay, editor } = await rig();
    const bo = { userId: 'bo', name: 'Bo', role: 'editor' as const };
    await relay.send(jsonFrame(5, FrameType.WsOpen, { path: '/feega-host', headers: { 'x-feega-visitor': encodeVisitor(ada) }, protocols: [] }));
    await relay.send(jsonFrame(6, FrameType.WsOpen, { path: '/feega-host', headers: { 'x-feega-visitor': encodeVisitor(bo) }, protocols: [] }));
    await waitFor(() => editor.sockets.length === 2, 'two local sockets');
    const edit = JSON.stringify({ kind: ToHost.Edit, ask: { at: 'a.svelte:1:1', prop: 'color', value: 'red' } });

    await relay.send(textFrame(5, edit));
    await relay.send(textFrame(6, edit));

    const refusal = await relay.next((f) => f.type === FrameType.WsText && f.streamId === 6);
    expect(JSON.parse(textOf(refusal.payload)!)).toEqual({ kind: ToView.Edited, ok: false, reason: 'Ada is editing this element' });
    await waitFor(() => editor.sockets[0].messages.length === 1, 'the first edit');
    expect(editor.sockets[1].messages).toEqual([]);
  });

  it('stamps what a visitor sends with who sent it, whatever the visitor claims', async () => {
    const { relay, editor } = await rig();
    await relay.send(jsonFrame(5, FrameType.WsOpen, { path: '/feega-host', headers: { 'x-feega-visitor': encodeVisitor(ada) }, protocols: [] }));
    await waitFor(() => editor.sockets[0], 'local editor socket');

    await relay.send(textFrame(5, JSON.stringify({ kind: ToHost.Edit, ask: { at: 'a.svelte:1:1', prop: 'color', value: 'red' }, by: { userId: 'host', name: 'Host' } })));

    await waitFor(() => editor.sockets[0].messages.length === 1, 'the edit');
    expect(JSON.parse(editor.sockets[0].messages[0]).by).toEqual({ userId: 'ada', name: 'Ada' });
  });

  it('shows where a visitor points and what they selected, without sending it to the editor', async () => {
    const seen: Present[][] = [];
    const { relay, editor } = await rig({ onPresence: (v) => seen.push(v) });
    await relay.send(jsonFrame(0, FrameType.Presence, { visitors: [{ ...ada }, { ...vera }] }));
    await relay.send(jsonFrame(5, FrameType.WsOpen, { path: '/feega-host', headers: { 'x-feega-visitor': encodeVisitor(ada) }, protocols: [] }));
    await waitFor(() => editor.sockets[0], 'local editor socket');

    await relay.send(textFrame(5, JSON.stringify({ kind: ToHost.Selected, at: { file: 'a.svelte', line: 3, col: 4 } })));
    await relay.send(textFrame(5, JSON.stringify({ kind: ToHost.Cursor, at: { x: 10, y: 20 } })));

    await waitFor(() => seen.at(-1)?.[0]?.cursor, 'the cursor');
    expect(seen.at(-1)).toEqual([{ ...ada, selection: 'a.svelte:3:4', cursor: { x: 10, y: 20 } }, vera]);
    expect(editor.sockets[0].messages).toEqual([]);
  });

  it('forgets the pointer and selection when the visitor clears them or leaves', async () => {
    const seen: Present[][] = [];
    const { relay, editor, client } = await rig({ onPresence: (v) => seen.push(v) });
    await relay.send(jsonFrame(0, FrameType.Presence, { visitors: [{ ...ada }] }));
    await relay.send(jsonFrame(5, FrameType.WsOpen, { path: '/feega-host', headers: { 'x-feega-visitor': encodeVisitor(ada) }, protocols: [] }));
    await waitFor(() => editor.sockets[0], 'local editor socket');
    await relay.send(textFrame(5, JSON.stringify({ kind: ToHost.Cursor, at: { x: 1, y: 2 } })));
    await waitFor(() => client.visitors()[0]?.cursor, 'the cursor');

    await relay.send(textFrame(5, JSON.stringify({ kind: ToHost.Cursor, at: null })));
    await waitFor(() => !client.visitors()[0]?.cursor, 'the cursor gone');
    await relay.send(textFrame(5, JSON.stringify({ kind: ToHost.Selected, at: { file: 'a.svelte', line: 1, col: 1 } })));
    await waitFor(() => client.visitors()[0]?.selection, 'the selection');
    await relay.send(jsonFrame(0, FrameType.Presence, { visitors: [] }));
    await relay.send(jsonFrame(0, FrameType.Presence, { visitors: [{ ...ada }] }));

    await waitFor(() => seen.length >= 6, 'updates');
    expect(client.visitors()).toEqual([ada]);
  });

  it('refuses a message that is not json from a visitor', async () => {
    const { relay, editor } = await rig();
    await relay.send(jsonFrame(3, FrameType.WsOpen, { path: '/feega-host', headers: { 'x-feega-visitor': encodeVisitor(ada) }, protocols: [] }));
    await waitFor(() => editor.sockets[0], 'local editor socket');

    await relay.send(textFrame(3, 'not json'));
    await relay.send(textFrame(3, JSON.stringify({ kind: ToHost.Ready })));

    await waitFor(() => editor.sockets[0].messages.length > 0, 'ready');
    expect(editor.sockets[0].messages).toEqual([JSON.stringify({ kind: ToHost.Ready, by: { userId: 'ada', name: 'Ada' } })]);
  });

  it('tunnels an app websocket untouched, protocols included', async () => {
    const { relay, app } = await rig();

    await relay.send(jsonFrame(9, FrameType.WsOpen, { path: '/?token=abc', headers: { 'x-feega-visitor': encodeVisitor(vera), origin: VISITOR_ORIGIN }, protocols: ['vite-hmr'] }));
    const local = await waitFor(() => app.sockets[0], 'local hmr socket');
    expect(local.protocol).toBe('vite-hmr');
    expect(local.origin).toBe(new URL(app.url).origin);

    await relay.send(textFrame(9, '{"type":"ping"}'));
    await waitFor(() => local.messages[0], 'forwarded text');
    expect(local.messages[0]).toBe('{"type":"ping"}');

    local.socket.send('{"type":"update"}');
    expect(textOf((await relay.next((f) => f.type === FrameType.WsText && f.streamId === 9)).payload)).toBe('{"type":"update"}');
    local.socket.send(Buffer.from([1, 2]));
    expect([...(await relay.next((f) => f.type === FrameType.WsBinary && f.streamId === 9)).payload]).toEqual([1, 2]);
  });

  it('closes the local socket when the relay closes the stream and tells the relay when the local one closes', async () => {
    const { relay, app } = await rig();
    await relay.send(jsonFrame(9, FrameType.WsOpen, { path: '/', headers: { 'x-feega-visitor': encodeVisitor(vera) }, protocols: [] }));
    await relay.send(jsonFrame(10, FrameType.WsOpen, { path: '/', headers: { 'x-feega-visitor': encodeVisitor(vera) }, protocols: [] }));
    await waitFor(() => app.sockets.length === 2, 'two sockets');

    await relay.send(jsonFrame(9, FrameType.WsClose, { code: 1000, reason: 'bye' }));
    await waitFor(() => app.sockets[0].socket.readyState === 3, 'closed local socket');

    app.sockets[1].socket.close(1000, 'server done');
    const closed = await relay.next((f) => f.type === FrameType.WsClose && f.streamId === 10);
    expect(jsonOf<{ code: number }>(closed)?.code).toBe(1000);
  });

  it('aborts a local request when the relay reports the stream cancelled', async () => {
    const slow = await localServer(() => undefined);
    cleanup.push(slow.close);
    const relay = await fakeRelay();
    const client = shareClient({ relayUrl: relay.url, hostToken: 't', editorUrl: slow.url, visitorOrigin: VISITOR_ORIGIN });
    cleanup.push(() => (client.close(), relay.close()));
    await client.ready;
    await relay.send(reqHead(11, '/panel.js'));
    await relay.send(emptyFrame(11, FrameType.ReqEnd));
    await waitFor(() => slow.seen.length === 1, 'the local request');

    await relay.send(jsonFrame(11, FrameType.Error, { message: 'cancelled' }));

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(relay.frames.filter((f) => f.streamId === 11)).toEqual([]);
  });

  it('reports who is here and can kick someone', async () => {
    const seen: Present[][] = [];
    const { relay, client } = await rig({ onPresence: (v) => seen.push(v) });

    await relay.send(jsonFrame(0, FrameType.Presence, { visitors: [{ ...ada }] }));

    await waitFor(() => seen.length === 1, 'presence');
    expect(seen[0]).toEqual([ada]);
    expect(client.visitors()).toEqual([ada]);
    client.kick('ada');
    const kick = await relay.next((f) => f.type === FrameType.Kick);
    expect(kick.streamId).toBe(0);
    expect(jsonOf(kick)).toEqual({ userId: 'ada' });
  });

  it('reconnects with a growing delay after the relay drops it', async () => {
    const delays: number[] = [];
    const { relay } = await rig({ sleep: async (ms) => void delays.push(ms) });

    relay.drop();
    await waitFor(() => relay.connections() === 2, 'a reconnect');
    relay.drop();
    await waitFor(() => relay.connections() === 3, 'a second reconnect');

    expect(delays.length).toBeGreaterThanOrEqual(2);
    expect(delays[1]).toBeGreaterThanOrEqual(delays[0]);
  });

  it('stops for good when the session ended or another host replaced it', async () => {
    const ended: string[] = [];
    const { relay } = await rig({ onEnded: (why) => ended.push(why), sleep: async () => undefined });

    relay.drop(4001);

    await waitFor(() => ended.length === 1, 'ended');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(relay.connections()).toBe(1);
    expect(ended).toEqual(['replaced']);
  });

  it('stops for good on idle and expiry', async () => {
    for (const [code, why] of [[4000, 'idle'], [4002, 'expired']] as const) {
      const ended: string[] = [];
      const { relay } = await rig({ onEnded: (w) => ended.push(w), sleep: async () => undefined });

      relay.drop(code);

      await waitFor(() => ended.length === 1, 'ended');
      expect(ended).toEqual([why]);
    }
  });

  it('tells the relay a visitor changed role and gates edits by the new role at once', async () => {
    const { relay, editor, client } = await rig();
    await relay.send(jsonFrame(4, FrameType.WsOpen, { path: '/feega-host', headers: { 'x-feega-visitor': encodeVisitor(vera) }, protocols: [] }));
    await relay.send(jsonFrame(5, FrameType.WsOpen, { path: '/feega-host', headers: { 'x-feega-visitor': encodeVisitor(ada) }, protocols: [] }));
    await waitFor(() => editor.sockets.length === 2, 'two local sockets');
    const edit = JSON.stringify({ kind: ToHost.Edit, ask: { at: 'a.svelte:1:1', prop: 'color', value: 'red' } });

    client.setRole('vera', 'editor');
    client.setRole('ada', 'viewer');

    expect(jsonOf((await relay.next((f) => f.type === FrameType.Role && jsonOf<{ userId: string }>(f)?.userId === 'vera'))!)).toEqual({ userId: 'vera', role: 'editor' });
    expect(jsonOf((await relay.next((f) => f.type === FrameType.Role))!)).toEqual({ userId: 'ada', role: 'viewer' });
    await relay.send(textFrame(4, edit));
    await relay.send(textFrame(5, edit));
    const refusal = await relay.next((f) => f.type === FrameType.WsText && f.streamId === 5);
    expect(JSON.parse(textOf(refusal.payload)!)).toEqual({ kind: ToView.Edited, ok: false, reason: 'viewers cannot edit' });
    await waitFor(() => editor.sockets[0].messages.length === 1, 'the promoted edit');
    expect(editor.sockets[1].messages).toEqual([]);
  });

  it('tells the relay the session is over before it disconnects', async () => {
    const { relay, client } = await rig();

    client.close();

    const close = await relay.next((f) => f.type === FrameType.Close);
    expect(close.streamId).toBe(0);
    expect(close.payload).toHaveLength(0);
  });

  it('does not reconnect after close', async () => {
    const { relay, client } = await rig({ sleep: async () => undefined });

    client.close();
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(relay.connections()).toBe(1);
  });

  it('refuses a first connection the relay rejects', async () => {
    const server = createServer();
    server.on('upgrade', (_request, socket) => socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n'));
    const port = await listen(server);
    cleanup.push(() => (server.closeAllConnections(), server.close()));
    const client = shareClient({ relayUrl: `ws://127.0.0.1:${port}/host`, hostToken: 'bad', editorUrl: 'http://127.0.0.1:1/', visitorOrigin: VISITOR_ORIGIN });

    await expect(client.ready).rejects.toThrow(/401/);
  });
});
