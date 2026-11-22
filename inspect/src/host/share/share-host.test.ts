import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { CloudError, CloudFailure, VisitorRole } from '../cloud-api';
import { FrameType, decodeFrame, jsonOf, type Frame } from '../../../../packages/share-protocol/src/frame';
import { shareHost, type ShareApi } from './share-host';

let closers: (() => void)[] = [];
afterEach(() => closers.splice(0).forEach((close) => close()));

async function relay(accept: boolean) {
  const tokens: string[] = [];
  const frames: Frame[] = [];
  const server = createServer();
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    tokens.push(new URL(request.url ?? '', 'http://x').searchParams.get('token') ?? '');
    accept ? wss.handleUpgrade(request, socket, head, (peer) => peer.on('message', (data: Buffer) => void frames.push(decodeFrame(new Uint8Array(data))!))) : socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  closers.push(() => (wss.close(), server.closeAllConnections(), server.close()));
  return { url: `ws://127.0.0.1:${(server.address() as AddressInfo).port}/host`, tokens, frames };
}

function apiStub(over: Partial<ShareApi> = {}) {
  const calls: { started: [string, VisitorRole][]; closed: string[]; members: [string, string, VisitorRole][] } = { started: [], closed: [], members: [] };
  const api: ShareApi = {
    startSession: async (name, role) => (calls.started.push([name, role]), { id: 'sess-1', url: 'https://abcdefghij.sessions.test', hostToken: 'host-jwt', expiresAt: '2026-11-22T00:00:00Z' }),
    closeSession: async (id) => (calls.closed.push(id), { snapshotUploadUrl: 'https://storage.test/upload?sig=1' }),
    setMember: async (id, userId, role) => (calls.members.push([id, userId, role]), {}),
    ...over
  };
  return { api, calls };
}

describe('shareHost', () => {
  it('opens a cloud session, connects the tunnel and returns the link', async () => {
    const { url, tokens } = await relay(true);
    const { api, calls } = apiStub();
    const host = shareHost({ api, relayUrl: url, send: fetch });

    const info = await host.start({ dir: '/work/My App', editorUrl: 'http://127.0.0.1:1/', visitorsCanEdit: true });

    expect(info).toEqual({ id: 'sess-1', url: 'https://abcdefghij.sessions.test', expiresAt: '2026-11-22T00:00:00Z' });
    expect(calls.started).toEqual([['My App', VisitorRole.Editor]]);
    expect(tokens).toEqual(['host-jwt']);
    await host.stop('sess-1');
  });

  it('shares read only unless visitors can edit', async () => {
    const { url } = await relay(true);
    const { api, calls } = apiStub();
    const host = shareHost({ api, relayUrl: url, send: fetch });

    await host.start({ dir: '/work/app', editorUrl: 'http://127.0.0.1:1/', visitorsCanEdit: false });

    expect(calls.started[0][1]).toBe(VisitorRole.Viewer);
    await host.stop('sess-1');
  });

  it('passes the plan error through without connecting', async () => {
    const { url, tokens } = await relay(true);
    const { api } = apiStub({ startSession: async () => Promise.reject(new CloudError(CloudFailure.PlanRequired, 'Feega Cloud needs a paid plan', 402)) });
    const host = shareHost({ api, relayUrl: url, send: fetch });

    await expect(host.start({ dir: '/a', editorUrl: 'http://127.0.0.1:1/', visitorsCanEdit: false })).rejects.toMatchObject({ failure: CloudFailure.PlanRequired });
    expect(tokens).toEqual([]);
  });

  it('closes the session again when the relay refuses it', async () => {
    const { url } = await relay(false);
    const { api, calls } = apiStub();
    const host = shareHost({ api, relayUrl: url, send: fetch });

    await expect(host.start({ dir: '/a', editorUrl: 'http://127.0.0.1:1/', visitorsCanEdit: false })).rejects.toThrow(/401/);
    expect(calls.closed).toEqual(['sess-1']);
  });

  it('on stop closes the session and uploads the final snapshot', async () => {
    const { url } = await relay(true);
    const app = createServer((_request, response) => response.writeHead(200, { 'content-type': 'text/html' }).end('<h1>final</h1>'));
    await new Promise<void>((resolve) => app.listen(0, '127.0.0.1', resolve));
    closers.push(() => app.close());
    const uploads: { url: string; method?: string; size: number }[] = [];
    const send = (async (target: string, init?: RequestInit) => {
      if (target.startsWith('https://storage.test')) {
        uploads.push({ url: target, method: init?.method, size: (init?.body as Uint8Array).length });
        return new Response(null, { status: 200 });
      }
      return fetch(target, init);
    }) as typeof fetch;
    const { api, calls } = apiStub();
    const host = shareHost({ api, relayUrl: url, send });
    await host.start({ dir: '/a', editorUrl: 'http://127.0.0.1:1/', appUrl: `http://127.0.0.1:${(app.address() as AddressInfo).port}/`, visitorsCanEdit: false });

    await host.stop('sess-1');

    expect(calls.closed).toEqual(['sess-1']);
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toMatchObject({ url: 'https://storage.test/upload?sig=1', method: 'PUT' });
    expect(uploads[0].size).toBeGreaterThan(20);
  });

  it('closes the session even when no snapshot can be taken', async () => {
    const { url } = await relay(true);
    const { api, calls } = apiStub();
    const host = shareHost({ api, relayUrl: url, send: fetch });
    await host.start({ dir: '/a', editorUrl: 'http://127.0.0.1:1/', visitorsCanEdit: false });

    await host.stop('sess-1');

    expect(calls.closed).toEqual(['sess-1']);
  });

  it('promotes through the api, then tells the tunnel', async () => {
    const { url, frames } = await relay(true);
    const { api, calls } = apiStub();
    const host = shareHost({ api, relayUrl: url, send: fetch });
    await host.start({ dir: '/a', editorUrl: 'http://127.0.0.1:1/', visitorsCanEdit: false });

    await host.setRole('sess-1', 'ada', 'editor');

    expect(calls.members).toEqual([['sess-1', 'ada', VisitorRole.Editor]]);
    await expect.poll(() => frames.filter((f) => f.type === FrameType.Role).map((f) => jsonOf(f))).toEqual([{ userId: 'ada', role: 'editor' }]);
    await host.stop('sess-1');
  });

  it('does not tell the tunnel when the api refuses the promotion', async () => {
    const { url, frames } = await relay(true);
    const { api } = apiStub({ setMember: async () => Promise.reject(new CloudError(CloudFailure.SeatsExhausted, 'No editor seats left', 402)) });
    const host = shareHost({ api, relayUrl: url, send: fetch });
    await host.start({ dir: '/a', editorUrl: 'http://127.0.0.1:1/', visitorsCanEdit: false });

    await expect(host.setRole('sess-1', 'ada', 'editor')).rejects.toMatchObject({ failure: CloudFailure.SeatsExhausted });
    await host.stop('sess-1');

    expect(frames.some((f) => f.type === FrameType.Role)).toBe(false);
  });

  it('sends the close frame on stop so visitors land on the snapshot', async () => {
    const { url, frames } = await relay(true);
    const { api } = apiStub();
    const host = shareHost({ api, relayUrl: url, send: fetch });
    await host.start({ dir: '/a', editorUrl: 'http://127.0.0.1:1/', visitorsCanEdit: false });

    await host.stop('sess-1');

    await expect.poll(() => frames.some((f) => f.type === FrameType.Close)).toBe(true);
  });

  it('refuses to stop a session it does not hold', async () => {
    const { api } = apiStub();

    await expect(shareHost({ api, relayUrl: 'ws://x', send: fetch }).stop('nope')).rejects.toThrow(/not sharing/);
  });
});
