import type { ClientRequest } from 'node:http';
import WebSocket from 'ws';
import { FrameType, bytesFrame, decodeFrame, emptyFrame, encodeFrame, jsonFrame, jsonOf, textFrame, textOf, type Frame, type ErrorBody, type Present, type Presence, type ReqHead, type VisitorInfo, type VisitorRole, type WsClose, type WsOpen, CONTROL_STREAM } from '../../../../packages/share-protocol/src/frame';
import { VISITOR_HEADER, decodeVisitor } from '../../../../packages/share-protocol/src/visitor';
import { ToView } from '../../messages';
import { editGate } from './gate';
import { localHeaders, localRequest } from './local';
import { viewForVisitor } from './view-filter';
import { Target, targetOfRequest, targetOfSocket } from './routes';

const BACKOFF_FIRST_MS = 500;
const BACKOFF_MAX_MS = 15_000;
const BACKOFF_FACTOR = 2;
const BODY_CHUNK = 64 * 1024;
const NORMAL_CLOSE = 1000;
const GOING_AWAY = 1001;

export enum Ended {
  Idle = 'idle',
  Replaced = 'replaced',
  Expired = 'expired',
  Closed = 'closed'
}

const FINAL_CODES: Record<number, Ended> = { 4000: Ended.Idle, 4001: Ended.Replaced, 4002: Ended.Expired };

export type ShareClientOptions = {
  relayUrl: string;
  hostToken: string;
  editorUrl: string;
  appUrl?: string;
  visitorOrigin: string;
  onPresence?: (visitors: Present[]) => void;
  onEnded?: (why: Ended) => void;
  sleep?: (ms: number) => Promise<void>;
};

export type ShareClient = { ready: Promise<void>; appUrl: () => string | null; visitors: () => Present[]; kick: (userId: string) => void; setRole: (userId: string, role: VisitorRole) => void; close: () => void };

type Stream = { abort: () => void; visitor?: VisitorInfo; request?: ClientRequest };

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function shareClient(options: ShareClientOptions): ShareClient {
  const { relayUrl, hostToken, editorUrl, visitorOrigin, onPresence, onEnded, sleep = pause } = options;
  const editor = new URL(editorUrl);
  let app: URL | null = options.appUrl ? new URL(options.appUrl) : null;
  const gate = editGate();
  const streams = new Map<number, Stream>();
  const sockets = new Map<number, { target: Target; visitor: VisitorInfo; forward: (payload: string | Buffer) => void }>();
  let relay: WebSocket | null = null;
  let present: Present[] = [];
  let stopped = false;
  let wasOpen = false;

  const send = (frame: Frame) => relay?.readyState === WebSocket.OPEN && relay.send(encodeFrame(frame));
  const sendJson = (streamId: number, type: FrameType, value: unknown) => send(jsonFrame(streamId, type, value));
  const sendError = (streamId: number, message: string) => sendJson(streamId, FrameType.Error, { message } satisfies ErrorBody);
  const baseOf = (target: Target) => (target === Target.Editor ? editor : app);

  function openRequest(streamId: number, head: ReqHead) {
    const target = targetOfRequest(head);
    const base = baseOf(target);
    if (!base) {
      sendError(streamId, 'the app address is not known yet');
      return;
    }
    const headers = localHeaders(head.headers, base, visitorOrigin, target);
    const request = localRequest(base, head, headers, {
      head: (status, replyHeaders) => sendJson(streamId, FrameType.ResHead, { status, headers: replyHeaders }),
      body: (bytes) => {
        for (let at = 0; at < bytes.length; at += BODY_CHUNK) {
          send(bytesFrame(streamId, FrameType.ResBody, bytes.subarray(at, at + BODY_CHUNK)));
        }
      },
      end: () => streams.delete(streamId) && send(emptyFrame(streamId, FrameType.ResEnd)),
      fail: (message) => streams.delete(streamId) && sendError(streamId, message)
    });
    streams.set(streamId, { abort: () => request.destroy(), request });
  }

  function viewFromLocal(streamId: number, data: WebSocket.RawData, isBinary: boolean, target: Target) {
    if (isBinary) {
      send(bytesFrame(streamId, FrameType.WsBinary, new Uint8Array(data as Buffer)));
      return;
    }
    const filtered = target === Target.Editor ? viewForVisitor(String(data), visitorOrigin) : { text: String(data), appUrl: undefined };
    filtered.appUrl && (app = new URL(filtered.appUrl));
    filtered.text !== null && send(textFrame(streamId, filtered.text));
  }

  function guarded(visitor: VisitorInfo, streamId: number, text: string, forward: (text: string) => void) {
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }
    const verdict = gate.check(visitor, (message ?? {}) as { kind?: string });
    if (verdict.ok) {
      forward(text);
      return;
    }
    verdict.quiet || send(textFrame(streamId, JSON.stringify({ kind: ToView.Edited, ok: false, reason: verdict.reason })));
  }

  function openSocket(streamId: number, open: WsOpen) {
    const target = targetOfSocket(open.path);
    const base = baseOf(target);
    const visitor = decodeVisitor(open.headers[VISITOR_HEADER]);
    if (!base || !visitor) {
      sendJson(streamId, FrameType.WsClose, { code: GOING_AWAY, reason: 'unavailable' } satisfies WsClose);
      return;
    }
    const local = new WebSocket(`ws://${base.host}${open.path}`, open.protocols, { headers: { origin: base.origin } });
    const queued: (string | Buffer)[] = [];
    const forward = (payload: string | Buffer) => (local.readyState === WebSocket.OPEN ? local.send(payload) : queued.push(payload));
    local.on('open', () => queued.splice(0).forEach((payload) => local.send(payload)));
    local.on('message', (data, isBinary) => viewFromLocal(streamId, data, isBinary, target));
    local.on('close', (code) => {
      const live = streams.delete(streamId);
      sockets.delete(streamId);
      live && sendJson(streamId, FrameType.WsClose, { code: code === 1005 ? NORMAL_CLOSE : code, reason: '' } satisfies WsClose);
      releaseIfGone(visitor);
    });
    local.on('error', () => local.terminate());
    streams.set(streamId, { abort: () => local.terminate(), visitor });
    sockets.set(streamId, { target, visitor, forward });
  }

  function releaseIfGone(visitor: VisitorInfo) {
    const stays = [...streams.values()].some((stream) => stream.visitor?.userId === visitor.userId);
    stays || gate.release(visitor.userId);
  }

  function fromVisitor(frame: Frame) {
    const socket = sockets.get(frame.streamId);
    if (!socket) {
      return;
    }
    if (frame.type === FrameType.WsBinary) {
      socket.forward(Buffer.from(frame.payload));
      return;
    }
    const text = textOf(frame.payload) ?? '';
    socket.target === Target.Editor ? guarded(socket.visitor, frame.streamId, text, socket.forward) : socket.forward(text);
  }

  function onFrame(frame: Frame) {
    const stream = streams.get(frame.streamId);
    const handlers: Partial<Record<FrameType, () => void>> = {
      [FrameType.ReqHead]: () => openRequest(frame.streamId, jsonOf<ReqHead>(frame)!),
      [FrameType.ReqBody]: () => stream?.request?.write(frame.payload),
      [FrameType.ReqEnd]: () => stream?.request?.end(),
      [FrameType.WsOpen]: () => openSocket(frame.streamId, jsonOf<WsOpen>(frame)!),
      [FrameType.WsText]: () => fromVisitor(frame),
      [FrameType.WsBinary]: () => fromVisitor(frame),
      [FrameType.WsClose]: () => release(frame.streamId),
      [FrameType.Error]: () => release(frame.streamId),
      [FrameType.Presence]: () => ((present = jsonOf<Presence>(frame)?.visitors ?? []), onPresence?.(present))
    };
    handlers[frame.type]?.();
  }

  function release(streamId: number) {
    const stream = streams.get(streamId);
    streams.delete(streamId);
    sockets.delete(streamId);
    stream?.abort();
  }

  const dropStreams = () => [...streams.keys()].forEach(release);

  let settled = (_value: void | PromiseLike<void>): void => undefined;
  let failed = (_reason: Error): void => undefined;
  const ready = new Promise<void>((resolve, reject) => ((settled = resolve), (failed = reject)));
  ready.catch(() => undefined);

  async function run() {
    let delay = BACKOFF_FIRST_MS;
    while (!stopped) {
      const code = await connectOnce();
      dropStreams();
      const ended = code === null ? undefined : FINAL_CODES[code];
      if (ended || stopped) {
        stopped = true;
        onEnded?.(ended ?? Ended.Closed);
        return;
      }
      await sleep(delay);
      delay = Math.min(delay * BACKOFF_FACTOR, BACKOFF_MAX_MS);
    }
  }

  function connectOnce(): Promise<number | null> {
    return new Promise((resolve) => {
      const socket = new WebSocket(`${relayUrl}?token=${encodeURIComponent(hostToken)}`);
      relay = socket;
      socket.on('open', () => ((wasOpen = true), settled()));
      socket.on('message', (data: Buffer, isBinary) => {
        const frame = isBinary ? decodeFrame(new Uint8Array(data)) : null;
        frame && onFrame(frame);
      });
      socket.on('unexpected-response', (_request, response) => {
        failed(new Error(`the relay refused the connection (${response.statusCode})`));
        stopped = true;
        resolve(null);
      });
      socket.on('error', (error) => {
        wasOpen || failed(error);
        wasOpen || (stopped = true);
      });
      socket.on('close', (code) => resolve(code));
    });
  }

  void run();

  return {
    ready,
    appUrl: () => app?.toString() ?? null,
    visitors: () => present,
    kick: (userId) => void send(jsonFrame(CONTROL_STREAM, FrameType.Kick, { userId })),
    setRole: (userId, role) => {
      [...sockets.values()].filter((socket) => socket.visitor.userId === userId).forEach((socket) => (socket.visitor.role = role));
      send(jsonFrame(CONTROL_STREAM, FrameType.Role, { userId, role }));
    },
    close: () => {
      stopped = true;
      send(emptyFrame(CONTROL_STREAM, FrameType.Close));
      relay?.close(NORMAL_CLOSE);
      dropStreams();
    }
  };
}
