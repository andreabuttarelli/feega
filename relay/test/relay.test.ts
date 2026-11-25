import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { FrameType, bytesFrame, emptyFrame, jsonFrame, jsonOf, textFrame, textOf } from '../../packages/share-protocol/src/frame';
import { decodeVisitor, VISITOR_HEADER } from '../../packages/share-protocol/src/visitor';
import { IDLE_MS, MAX_VISITORS } from '../src/limits';
import { HOUR_S, ORIGIN, connectHost, connectVisitor, cookieFor, freshSid, headOf, nowS, sessionStub, tokenFor, visit, visitorUrl, type Peer } from './harness';

const CLOSE_NORMAL = 1000;
const encode = (text: string) => new TextEncoder().encode(text);

async function answer(host: Peer, body: string, status = 200) {
  const head = await host.next((f) => f.type === FrameType.ReqHead);
  host.sendJson(head.streamId, FrameType.ResHead, { status, headers: { 'content-type': 'text/plain' } });
  host.send(bytesFrame(head.streamId, FrameType.ResBody, encode(body)));
  host.send(emptyFrame(head.streamId, FrameType.ResEnd));
  return head;
}

describe('host endpoint', () => {
  it('refuses a missing, bad or non-host token', async () => {
    const sid = freshSid();
    const get = (query: string) => exports.default.fetch(`http://127.0.0.1:8787/host${query}`, { headers: { Upgrade: 'websocket' } });

    expect((await get('')).status).toBe(401);
    expect((await get('?token=garbage')).status).toBe(401);
    expect((await get(`?token=${await tokenFor(sid, { role: 'viewer' })}`)).status).toBe(403);
    expect((await get(`?token=${await tokenFor(sid, { role: 'host', exp: nowS() - 5 })}`)).status).toBe(401);
  });

  it('requires a websocket upgrade', async () => {
    const response = await exports.default.fetch(`http://127.0.0.1:8787/host?token=${await tokenFor(freshSid(), { role: 'host' })}`);

    expect(response.status).toBe(426);
  });

  it('takes the sid from the token and replaces an earlier host socket', async () => {
    const sid = freshSid();
    const first = await connectHost(sid);
    await connectHost(sid);

    await expect.poll(() => first.closes.length).toBe(1);
    expect(first.closes[0].code).toBe(4001);
  });
});

describe('visitor auth', () => {
  it('redirects a visitor without a valid cookie to the web login', async () => {
    const sid = freshSid();
    const bare = await exports.default.fetch(visitorUrl(sid, '/a?b=1'), { redirect: 'manual' });
    const other = await exports.default.fetch(visitorUrl(sid, '/a?b=1'), { redirect: 'manual', headers: { cookie: await cookieFor(freshSid()) } });
    const garbage = await exports.default.fetch(visitorUrl(sid, '/'), { redirect: 'manual', headers: { cookie: 'feega_visit=nope' } });

    expect(bare.status).toBe(302);
    expect(bare.headers.get('location')).toBe(`http://web.test/s/${sid}?next=%2Fa%3Fb%3D1`);
    expect(other.status).toBe(302);
    expect(garbage.status).toBe(302);
  });

  it('refuses a websocket upgrade without a cookie', async () => {
    const response = await exports.default.fetch(visitorUrl(freshSid(), '/feega-host'), { headers: { Upgrade: 'websocket' } });

    expect(response.status).toBe(401);
  });

  it('sets the cookie and redirects to next', async () => {
    const sid = freshSid();
    const token = await tokenFor(sid, { role: 'editor' });

    const response = await exports.default.fetch(visitorUrl(sid, `/__feega/auth?token=${token}&next=%2Fdocs%3Fx%3D1`), { redirect: 'manual' });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/docs?x=1');
    const cookie = response.headers.get('set-cookie')!;
    expect(cookie).toContain(`feega_visit=${token}`);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).not.toMatch(/Domain/i);
    expect(Number(cookie.match(/Max-Age=(\d+)/)![1])).toBeLessThanOrEqual(HOUR_S);
  });

  it('does not redirect to another origin', async () => {
    const sid = freshSid();
    const response = await exports.default.fetch(visitorUrl(sid, `/__feega/auth?token=${await tokenFor(sid)}&next=https%3A%2F%2Fevil.com`), { redirect: 'manual' });

    expect(response.headers.get('location')).toBe('/');
  });

  it('refuses a token for another session, an expired one, or a host token', async () => {
    const sid = freshSid();
    const auth = async (token: string) => (await exports.default.fetch(visitorUrl(sid, `/__feega/auth?token=${token}`), { redirect: 'manual' })).status;

    expect(await auth(await tokenFor(freshSid()))).toBe(403);
    expect(await auth(await tokenFor(sid, { exp: nowS() - 1 }))).toBe(401);
    expect(await auth(await tokenFor(sid, { role: 'host' }))).toBe(403);
    expect(await auth('garbage')).toBe(401);
  });
});

describe('http through the tunnel', () => {
  it('says the host is offline when nobody is connected', async () => {
    const response = await visit(freshSid(), '/');

    expect(response.status).toBe(503);
  });

  it('sends a browser page visit to the offline page of the web app', async () => {
    const sid = freshSid();

    const response = await visit(sid, '/deep?x=1', {}, { headers: { accept: 'text/html,application/xhtml+xml' } });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`http://web.test/s/${sid}?offline=1`);
  });

  it('streams a request to the host and the answer back', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);

    const pending = visit(sid, '/hello?x=1', { role: 'editor', sub: 'u-9', name: 'Zoë' }, { headers: { accept: 'text/html' } });
    const head = await answer(host, 'hi there');
    const response = await pending;

    const request = headOf(head);
    expect(request.method).toBe('GET');
    expect(request.path).toBe('/hello?x=1');
    expect(request.headers.accept).toBe('text/html');
    expect(decodeVisitor(request.headers[VISITOR_HEADER])).toEqual({ userId: 'u-9', name: 'Zoë', role: 'editor' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(await response.text()).toBe('hi there');
  });

  it('never lets a visitor choose the visitor header or leak the visit cookie', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);

    const cookie = `app=1; ${await cookieFor(sid, { role: 'viewer', sub: 'real' })}`;
    const pending = exports.default.fetch(visitorUrl(sid, '/'), { headers: { cookie, [VISITOR_HEADER]: JSON.stringify({ userId: 'x', name: 'Mallory', role: 'editor' }), 'x-feega-intent': 'host' } });
    const head = await answer(host, 'ok');
    await pending;

    const { headers } = headOf(head);
    expect(decodeVisitor(headers[VISITOR_HEADER])?.userId).toBe('real');
    expect(decodeVisitor(headers[VISITOR_HEADER])?.role).toBe('viewer');
    expect(headers.cookie).toBe('app=1');
  });

  it('forwards a request body in order and ends the stream', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);

    const pending = visit(sid, '/save', { role: 'editor' }, { method: 'POST', body: 'payload-123' });
    const head = await host.next((f) => f.type === FrameType.ReqHead);
    const body = await host.next((f) => f.type === FrameType.ReqBody);
    await host.next((f) => f.type === FrameType.ReqEnd);
    host.sendJson(head.streamId, FrameType.ResHead, { status: 201, headers: {} });
    host.send(emptyFrame(head.streamId, FrameType.ResEnd));
    const response = await pending;

    expect(headOf(head).method).toBe('POST');
    expect(textOf(body.payload)).toBe('payload-123');
    expect(response.status).toBe(201);
  });

  it('serves bodyless statuses without a body', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);

    const pending = visit(sid, '/cached');
    const head = await host.next((f) => f.type === FrameType.ReqHead);
    host.sendJson(head.streamId, FrameType.ResHead, { status: 304, headers: {} });
    host.send(emptyFrame(head.streamId, FrameType.ResEnd));

    expect((await pending).status).toBe(304);
  });

  it('answers 502 when the host reports an error on the stream', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);

    const pending = visit(sid, '/boom');
    const head = await host.next((f) => f.type === FrameType.ReqHead);
    host.sendJson(head.streamId, FrameType.Error, { message: 'local server down' });

    expect((await pending).status).toBe(502);
  });

  it('answers 502 to requests in flight when the host drops', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);

    const pending = visit(sid, '/slow');
    await host.next((f) => f.type === FrameType.ReqHead);
    host.socket.close(CLOSE_NORMAL, 'bye');

    expect((await pending).status).toBe(502);
  });

  it('keeps two concurrent requests apart', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);

    const first = visit(sid, '/one');
    const second = visit(sid, '/two');
    const heads = [await host.next((f) => f.type === FrameType.ReqHead), await host.next((f) => f.type === FrameType.ReqHead)];
    for (const head of heads.reverse()) {
      const path = headOf(head).path;
      host.sendJson(head.streamId, FrameType.ResHead, { status: 200, headers: {} });
      host.send(bytesFrame(head.streamId, FrameType.ResBody, encode(`for ${path}`)));
      host.send(emptyFrame(head.streamId, FrameType.ResEnd));
    }

    expect(await (await first).text()).toBe('for /one');
    expect(await (await second).text()).toBe('for /two');
  });
});

describe('websockets through the tunnel', () => {
  it('opens a stream on the host with the path, protocols and visitor, then relays text both ways', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);

    const visitor = await connectVisitor(sid, '/?token=abc', { role: 'editor', sub: 'u-3' }, { 'Sec-WebSocket-Protocol': 'vite-hmr' });
    const open = await host.next((f) => f.type === FrameType.WsOpen);
    const info = jsonOf<{ path: string; headers: Record<string, string>; protocols: string[] }>(open)!;

    expect(info.path).toBe('/?token=abc');
    expect(info.protocols).toEqual(['vite-hmr']);
    expect(decodeVisitor(info.headers[VISITOR_HEADER])?.userId).toBe('u-3');

    visitor.socket.send('from visitor');
    const up = await host.next((f) => f.type === FrameType.WsText);
    expect(up.streamId).toBe(open.streamId);
    expect(textOf(up.payload)).toBe('from visitor');

    host.send(textFrame(open.streamId, 'from host'));
    await expect.poll(() => visitor.texts).toEqual(['from host']);
  });

  it('relays binary messages', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);
    const visitor = await connectVisitor(sid);
    const open = await host.next((f) => f.type === FrameType.WsOpen);

    visitor.socket.send(new Uint8Array([1, 2, 3]));
    const up = await host.next((f) => f.type === FrameType.WsBinary);

    expect([...up.payload]).toEqual([1, 2, 3]);
    expect(up.streamId).toBe(open.streamId);
  });

  it('tells the host when a visitor closes and closes the visitor when the host does', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);
    const gone = await connectVisitor(sid);
    const kept = await connectVisitor(sid, '/feega-host', { sub: 'user-2' });
    const goneOpen = await host.next((f) => f.type === FrameType.WsOpen);
    const keptOpen = await host.next((f) => f.type === FrameType.WsOpen);

    gone.socket.close(CLOSE_NORMAL, 'tab closed');
    const closed = await host.next((f) => f.type === FrameType.WsClose);
    expect(closed.streamId).toBe(goneOpen.streamId);

    host.sendJson(keptOpen.streamId, FrameType.WsClose, { code: CLOSE_NORMAL, reason: 'server closed' });
    await expect.poll(() => kept.closes.length).toBe(1);
  });

  it('closes every visitor when the host leaves', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);
    const visitor = await connectVisitor(sid);
    await host.next((f) => f.type === FrameType.WsOpen);

    host.socket.close(CLOSE_NORMAL, 'stopped');

    await expect.poll(() => visitor.closes.length).toBe(1);
  });

  it('refuses a websocket when the host is offline', async () => {
    const sid = freshSid();

    await expect(connectVisitor(sid)).rejects.toThrow(/503/);
  });
});

describe('presence and kick', () => {
  const presence = async (host: Peer) => jsonOf<{ visitors: { userId: string; name: string; role: string }[] }>(await host.next((f) => f.type === FrameType.Presence))!.visitors;
  const latest = async (host: Peer, size: number) => {
    let visitors = await presence(host);
    while (visitors.length !== size) {
      visitors = await presence(host);
    }
    return visitors;
  };

  it('tells the host who is here, once per person, on join and leave', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);
    expect(await presence(host)).toEqual([]);

    const ada = await connectVisitor(sid, '/feega-host', { sub: 'ada', name: 'Ada', role: 'editor' });
    await connectVisitor(sid, '/hmr', { sub: 'ada', name: 'Ada', role: 'editor' });
    const bo = await connectVisitor(sid, '/feega-host', { sub: 'bo', name: 'Bo', role: 'viewer' });

    expect(await latest(host, 2)).toEqual([
      { userId: 'ada', name: 'Ada', role: 'editor' },
      { userId: 'bo', name: 'Bo', role: 'viewer' }
    ]);

    bo.socket.close(CLOSE_NORMAL, 'bye');
    expect(await latest(host, 1)).toEqual([{ userId: 'ada', name: 'Ada', role: 'editor' }]);
    ada.socket.close(CLOSE_NORMAL, 'bye');
  });

  it('kicks a user off: their sockets close and they cannot come back', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);
    const mallory = await connectVisitor(sid, '/feega-host', { sub: 'mallory', name: 'M' });
    const ada = await connectVisitor(sid, '/feega-host', { sub: 'ada', name: 'Ada' });

    host.sendJson(0, FrameType.Kick, { userId: 'mallory' });

    await expect.poll(() => mallory.closes.map((c) => c.code)).toEqual([4003]);
    expect(ada.closes).toEqual([]);
    expect((await visit(sid, '/', { sub: 'mallory' })).status).toBe(403);
    await expect(connectVisitor(sid, '/feega-host', { sub: 'mallory' })).rejects.toThrow(/403/);
  });
});

describe('role changes from the host', () => {
  const lastPresence = async (host: Peer) => jsonOf<{ visitors: { userId: string; role: string }[] }>(await host.next((f) => f.type === FrameType.Presence))!.visitors;

  it('promotes a visitor over the role in the cookie and announces it', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);
    await connectVisitor(sid, '/feega-host', { sub: 'ada', name: 'Ada', role: 'viewer' });
    await host.next((f) => f.type === FrameType.WsOpen);

    host.sendJson(0, FrameType.Role, { userId: 'ada', role: 'editor' });

    let visitors = await lastPresence(host);
    while (visitors.find((v) => v.userId === 'ada')?.role !== 'editor') {
      visitors = await lastPresence(host);
    }
    const again = await connectVisitor(sid, '/hmr', { sub: 'ada', name: 'Ada', role: 'viewer' });
    const open = await host.next((f) => f.type === FrameType.WsOpen);
    expect(decodeVisitor(jsonOf<{ headers: Record<string, string> }>(open)!.headers[VISITOR_HEADER])?.role).toBe('editor');
    again.socket.close(CLOSE_NORMAL, 'bye');
  });

  const roleOnRequest = async (host: Peer, sid: string, cookieRole: 'viewer' | 'editor') => {
    const response = visit(sid, '/a', { sub: 'ada', role: cookieRole });
    const head = await host.next((f) => f.type === FrameType.ReqHead);
    host.sendJson(head.streamId, FrameType.ResHead, { status: 200, headers: {} });
    host.send(emptyFrame(head.streamId, FrameType.ResEnd));
    await response;
    return decodeVisitor(headOf(head).headers[VISITOR_HEADER])?.role;
  };

  it('applies the new role to plain requests too, and demotes', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);

    host.sendJson(0, FrameType.Role, { userId: 'ada', role: 'editor' });
    expect(await roleOnRequest(host, sid, 'viewer')).toBe('editor');

    host.sendJson(0, FrameType.Role, { userId: 'ada', role: 'viewer' });
    expect(await roleOnRequest(host, sid, 'editor')).toBe('viewer');
  });

  it('ignores a role frame with a bad role', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);

    host.sendJson(0, FrameType.Role, { userId: 'ada', role: 'host' });

    expect(await roleOnRequest(host, sid, 'viewer')).toBe('viewer');
  });
});

describe('a closed session', () => {
  const snapshotPage = (sid: string) => `http://web.test/s/${sid}`;

  it('redirects every visitor request to the snapshot page once the host closed it', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);
    const visitor = await connectVisitor(sid);

    host.send(emptyFrame(0, FrameType.Close));
    host.socket.close(CLOSE_NORMAL, 'stopped');

    await expect.poll(() => visitor.closes.length).toBe(1);
    await expect.poll(async () => (await visit(sid, '/deep?x=1')).headers.get('location')).toBe(snapshotPage(sid));
    expect((await visit(sid, '/deep?x=1')).status).toBe(302);
    await expect(connectVisitor(sid)).rejects.toThrow(/302/);
  });

  it('stays closed when the host connects again', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);
    host.send(emptyFrame(0, FrameType.Close));
    await expect.poll(async () => (await visit(sid, '/')).status).toBe(302);

    await expect(connectHost(sid)).rejects.toThrow(/410/);
    expect((await visit(sid, '/')).headers.get('location')).toBe(snapshotPage(sid));
  });

  it('keeps saying the host is offline when the host merely dropped', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);

    host.socket.close(CLOSE_NORMAL, 'dropped');

    await expect.poll(async () => (await visit(sid, '/')).status).toBe(503);
    const back = await connectHost(sid);
    const pending = visit(sid, '/again');
    await answer(back, 'welcome back');
    expect(await (await pending).text()).toBe('welcome back');
  });
});

describe('limits', () => {
  it('admits ten people and refuses the eleventh, but lets a present one open more sockets', async () => {
    const sid = freshSid();
    await connectHost(sid);
    for (let i = 0; i < MAX_VISITORS; i++) {
      await connectVisitor(sid, '/feega-host', { sub: `user-${i}` });
    }

    await expect(connectVisitor(sid, '/feega-host', { sub: 'user-extra' })).rejects.toThrow(/503/);
    expect((await visit(sid, '/', { sub: 'user-extra' })).status).toBe(503);
    await expect(connectVisitor(sid, '/hmr', { sub: 'user-0' })).resolves.toBeDefined();
  });

  it('closes the session after 30 minutes with no visitor', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);
    await runInDurableObject(sessionStub(sid), async (_instance, state) => state.storage.put('emptySince', Date.now() - IDLE_MS - 1000));

    expect(await runDurableObjectAlarm(sessionStub(sid))).toBe(true);

    await expect.poll(() => host.closes.map((c) => c.code)).toEqual([4000]);
    expect((await visit(sid, '/')).status).toBe(503);
  });

  it('keeps the session while a visitor is here, however long the host has been alone before', async () => {
    const sid = freshSid();
    const host = await connectHost(sid);
    await runInDurableObject(sessionStub(sid), async (_instance, state) => state.storage.put('emptySince', Date.now() - IDLE_MS - 1000));
    await connectVisitor(sid);

    await runDurableObjectAlarm(sessionStub(sid));

    expect(host.closes).toEqual([]);
  });

  it('closes everything at the session expiry', async () => {
    const sid = freshSid();
    const host = await connectHost(sid, { exp: nowS() + HOUR_S });
    const visitor = await connectVisitor(sid);
    await runInDurableObject(sessionStub(sid), async (_instance, state) => state.storage.put('expMs', Date.now() - 1));

    await runDurableObjectAlarm(sessionStub(sid));

    await expect.poll(() => host.closes.map((c) => c.code)).toEqual([4002]);
    await expect.poll(() => visitor.closes.length).toBe(1);
  });
});
