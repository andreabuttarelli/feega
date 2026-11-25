import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newSid } from '../../packages/share-protocol/src/sid';
import { shareClient, type ShareClient } from '../../inspect/src/host/share/client';
import { shareHost, type ShareApi } from '../../inspect/src/host/share/share-host';
import { SOCKET_PATH, ToHost, ToView } from '../../inspect/src/messages';
import { MAX_VISITORS } from '../src/limits';
import { BOOT_MS, WAIT_MS, HOUR_S, HTTP_FOUND, HTTP_OK, HTTP_UNAVAILABLE, LOOPBACK, WEB_ORIGIN, bootRelay, cookieOf, get, listening, localApp, localEditor, openVisitor, replyWhere, token, until, type Relay, type Visitor } from './rig';
import type { Server } from 'node:http';

const heard = (message: string, userId: string) => `editor-got:${JSON.stringify({ ...JSON.parse(message), by: { userId, name: 'Ada' } })}`;

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
    expect(await until(() => editorVisitor.inbox[0])).toBe(heard(edit, 'editor-1'));
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

    expect(await until(() => before.inbox[1])).toBe(heard(edit, 'promoted'));
    expect(await until(() => after.inbox[0])).toBe(heard(edit, 'promoted'));

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
