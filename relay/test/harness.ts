import { env, exports } from 'cloudflare:workers';
import { decodeFrame, encodeFrame, jsonFrame, jsonOf, type Frame, type FrameType } from '../../packages/share-protocol/src/frame';
import { newSid } from '../../packages/share-protocol/src/sid';
import { signToken, type Claims } from '../../packages/share-protocol/src/token';
import { VISIT_COOKIE } from '../../packages/share-protocol/src/visitor';

export const SECRET = 'relay-test-secret';
export const ORIGIN = 'localhost:8787';
export const HOUR_S = 3600;

export const nowS = () => Math.floor(Date.now() / 1000);
export const freshSid = () => newSid();

export const claimsFor = (sid: string, over: Partial<Claims> = {}): Claims => ({ sid, role: 'viewer', sub: 'user-1', org: 'org-1', exp: nowS() + HOUR_S, name: 'Ada', ...over });

export const tokenFor = (sid: string, over: Partial<Claims> = {}) => signToken(claimsFor(sid, over), SECRET);

export const visitorUrl = (sid: string, path = '/') => `http://${sid}.${ORIGIN}${path}`;

export const cookieFor = async (sid: string, over: Partial<Claims> = {}) => `${VISIT_COOKIE}=${await tokenFor(sid, { role: 'viewer', ...over })}`;

export const visit = async (sid: string, path: string, over: Partial<Claims> = {}, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('cookie', await cookieFor(sid, over));
  return exports.default.fetch(visitorUrl(sid, path), { redirect: 'manual', ...init, headers });
};

export type Peer = { socket: WebSocket; frames: Frame[]; texts: string[]; closes: { code: number; reason: string }[]; next: (match?: (frame: Frame) => boolean) => Promise<Frame>; send: (frame: Frame) => void; sendJson: (streamId: number, type: FrameType, value: unknown) => void };

const WAIT_MS = 3000;

function peerOf(socket: WebSocket): Peer {
  const frames: Frame[] = [];
  const texts: string[] = [];
  const closes: { code: number; reason: string }[] = [];
  const waiting: (() => void)[] = [];
  socket.binaryType = 'arraybuffer';
  socket.accept();
  socket.addEventListener('message', (event) => {
    if (typeof event.data === 'string') {
      texts.push(event.data);
    } else {
      const frame = decodeFrame(event.data as ArrayBuffer);
      frame && frames.push(frame);
    }
    waiting.splice(0).forEach((wake) => wake());
  });
  socket.addEventListener('close', (event) => {
    closes.push({ code: event.code, reason: event.reason });
    waiting.splice(0).forEach((wake) => wake());
  });
  const next = async (match: (frame: Frame) => boolean = () => true) => {
    const deadline = Date.now() + WAIT_MS;
    while (Date.now() < deadline) {
      const at = frames.findIndex(match);
      if (at >= 0) {
        return frames.splice(at, 1)[0];
      }
      await new Promise<void>((resolve) => (waiting.push(resolve), setTimeout(resolve, 50)));
    }
    throw new Error('no matching frame in time');
  };
  return { socket, frames, texts, closes, next, send: (frame) => socket.send(encodeFrame(frame)), sendJson: (streamId, type, value) => socket.send(encodeFrame(jsonFrame(streamId, type, value))) };
}

export async function connectHost(sid: string, over: Partial<Claims> = {}): Promise<Peer> {
  const token = await tokenFor(sid, { role: 'host', ...over });
  const response = await exports.default.fetch(`http://127.0.0.1:8787/host?token=${token}`, { headers: { Upgrade: 'websocket' } });
  if (response.status !== 101 || !response.webSocket) {
    throw new Error(`host refused: ${response.status}`);
  }
  return peerOf(response.webSocket);
}

export async function connectVisitor(sid: string, path = '/feega-host', over: Partial<Claims> = {}, extra: Record<string, string> = {}): Promise<Peer> {
  const response = await exports.default.fetch(visitorUrl(sid, path), { redirect: 'manual', headers: { Upgrade: 'websocket', cookie: await cookieFor(sid, over), ...extra } });
  if (response.status !== 101 || !response.webSocket) {
    throw new Error(`visitor refused: ${response.status}`);
  }
  return peerOf(response.webSocket);
}

export const sessionStub = (sid: string) => env.SESSION.get(env.SESSION.idFromName(sid));

export const headOf = (frame: Frame) => jsonOf<{ method: string; path: string; headers: Record<string, string> }>(frame)!;
