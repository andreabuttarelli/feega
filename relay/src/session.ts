import { DurableObject } from 'cloudflare:workers';
import { CONTROL_STREAM, FrameType, MAX_STREAM_ID, bytesFrame, decodeFrame, emptyFrame, encodeFrame, jsonFrame, jsonOf, textFrame, textOf, type ErrorBody, type Frame, type Kick, type Present, type Roled, type ReqHead, type ResHead, type WsClose } from '../../packages/share-protocol/src/frame';
import { VISITOR_HEADER, decodeVisitor, withVisitor } from '../../packages/share-protocol/src/visitor';
import type { VisitorInfo, VisitorRole } from '../../packages/share-protocol/src/frame';
import { CloseCode, EXP_HEADER, INTENT_HEADER, Intent, SID_HEADER, type Env } from './env';
import { Deadline, MAX_VISITORS, deadlineOf } from './limits';
import { forwardHeaders, snapshotUrl } from './routing';
import { failure, pendingResponse, type Pending } from './streams';

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_GONE = 410;
const HTTP_FOUND = 302;
const VISITOR_ROLES: readonly string[] = ['editor', 'viewer'] satisfies VisitorRole[];
const HTTP_UNAVAILABLE = 503;
const WS_OPEN_STATE = 1;
const WS_SWITCHING = 101;
const STREAM_BLOCK = 1_000_000;
const BODY_CHUNK = 64 * 1024;
const HEAD_TIMEOUT_MS = 30_000;
const VALID_CLOSE = (code: number) => code === 1000 || (code >= 1001 && code <= 1003) || (code >= 1007 && code <= 1014) || (code >= 3000 && code <= 4999);

enum Tag {
  Host = 'host',
  Visitor = 'visitor'
}

enum Key {
  Exp = 'expMs',
  Empty = 'emptySince',
  Kicked = 'kicked',
  Roles = 'roles',
  Closed = 'closed',
  Block = 'streamBlock'
}

type Attachment = { host: true } | { host: false; streamId: number; visitor: VisitorInfo };

const streamTag = (id: number) => `s:${id}`;
const userTag = (id: string) => `u:${id}`;
const safeCode = (code: number) => (VALID_CLOSE(code) ? code : CloseCode.Normal);
const isOpen = (socket: WebSocket) => socket.readyState === WS_OPEN_STATE;

export class Session extends DurableObject<Env> {
  private pending = new Map<number, Pending>();
  private next = 1;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const block = (await ctx.storage.get<number>(Key.Block)) ?? 0;
      await ctx.storage.put(Key.Block, block + 1);
      this.next = ((block * STREAM_BLOCK) % MAX_STREAM_ID) + 1;
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get(INTENT_HEADER) === Intent.Host) {
      return this.acceptHost(request);
    }
    return this.admitVisitor(request);
  }

  private hostSocket(except?: WebSocket): WebSocket | null {
    return this.ctx.getWebSockets(Tag.Host).find((socket) => socket !== except && isOpen(socket)) ?? null;
  }

  private visitorSockets(leaving: WebSocket[] = []): WebSocket[] {
    return this.ctx.getWebSockets(Tag.Visitor).filter((socket) => !leaving.includes(socket) && isOpen(socket));
  }

  private present(leaving: WebSocket[] = []): Present[] {
    const byUser = new Map<string, Present>();
    for (const socket of this.visitorSockets(leaving)) {
      const attachment = socket.deserializeAttachment() as Attachment;
      if (!attachment.host) {
        byUser.set(attachment.visitor.userId, { ...attachment.visitor });
      }
    }
    return [...byUser.values()];
  }

  private sendToHost(frame: Frame) {
    this.hostSocket()?.send(encodeFrame(frame));
  }

  private announce(leaving: WebSocket[] = []) {
    this.sendToHost(jsonFrame(CONTROL_STREAM, FrameType.Presence, { visitors: this.present(leaving) }));
  }

  private async schedule() {
    const expMs = await this.ctx.storage.get<number>(Key.Exp);
    if (expMs === undefined) {
      return;
    }
    const emptySince = (await this.ctx.storage.get<number>(Key.Empty)) ?? null;
    await this.ctx.storage.setAlarm(deadlineOf({ expMs, emptySince }).at);
  }

  private async markPresence(someone: boolean) {
    someone ? await this.ctx.storage.delete(Key.Empty) : await this.ctx.storage.put(Key.Empty, Date.now());
    await this.schedule();
  }

  private async isClosed(): Promise<boolean> {
    return (await this.ctx.storage.get<boolean>(Key.Closed)) === true;
  }

  private async acceptHost(request: Request): Promise<Response> {
    if (await this.isClosed()) {
      return failure(HTTP_GONE, 'this session is closed');
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const previous = this.hostSocket();
    this.ctx.acceptWebSocket(server, [Tag.Host]);
    server.serializeAttachment({ host: true } satisfies Attachment);
    await this.ctx.storage.put(Key.Exp, Number(request.headers.get(EXP_HEADER)));
    previous?.close(CloseCode.Replaced, 'replaced by a newer host connection');
    await this.markPresence(this.visitorSockets().length > 0);
    this.announce();
    return new Response(null, { status: WS_SWITCHING, webSocket: client });
  }

  private async isKicked(userId: string): Promise<boolean> {
    return ((await this.ctx.storage.get<string[]>(Key.Kicked)) ?? []).includes(userId);
  }

  private async roleOf(visitor: VisitorInfo): Promise<VisitorInfo> {
    const roles = (await this.ctx.storage.get<Record<string, VisitorRole>>(Key.Roles)) ?? {};
    return { ...visitor, role: roles[visitor.userId] ?? visitor.role };
  }

  private async admitVisitor(request: Request): Promise<Response> {
    const decoded = decodeVisitor(request.headers.get(VISITOR_HEADER));
    if (!decoded) {
      return failure(HTTP_BAD_REQUEST, 'visitor missing');
    }
    if (await this.isClosed()) {
      return Response.redirect(snapshotUrl(this.env.WEB_ORIGIN, request.headers.get(SID_HEADER) ?? ''), HTTP_FOUND);
    }
    const visitor = await this.roleOf(decoded);
    if (await this.isKicked(visitor.userId)) {
      return failure(HTTP_FORBIDDEN, 'removed from this session');
    }
    const host = this.hostSocket();
    if (!host) {
      return failure(HTTP_UNAVAILABLE, 'the host is offline');
    }
    const here = this.present();
    if (here.length >= MAX_VISITORS && !here.some((p) => p.userId === visitor.userId)) {
      return failure(HTTP_UNAVAILABLE, 'this session is full');
    }
    const headers = withVisitor(forwardHeaders(request.headers), visitor);
    return request.headers.get('upgrade')?.toLowerCase() === 'websocket' ? this.openSocket(request, visitor, headers) : this.proxy(request, headers);
  }

  private async openSocket(request: Request, visitor: VisitorInfo, headers: Record<string, string>): Promise<Response> {
    const streamId = this.next++;
    const url = new URL(request.url);
    const protocols = (request.headers.get('sec-websocket-protocol') ?? '').split(',').map((p) => p.trim()).filter(Boolean);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [Tag.Visitor, streamTag(streamId), userTag(visitor.userId)]);
    server.serializeAttachment({ host: false, streamId, visitor } satisfies Attachment);
    this.sendToHost(jsonFrame(streamId, FrameType.WsOpen, { path: url.pathname + url.search, headers, protocols }));
    await this.markPresence(true);
    this.announce();
    const reply = protocols.length > 0 ? { 'sec-websocket-protocol': protocols[0] } : undefined;
    return new Response(null, { status: WS_SWITCHING, webSocket: client, headers: reply });
  }

  private proxy(request: Request, headers: Record<string, string>): Promise<Response> {
    const streamId = this.next++;
    const url = new URL(request.url);
    const { response, pending } = pendingResponse();
    this.pending.set(streamId, pending);
    const forget = () => void this.pending.delete(streamId);
    const timer = setTimeout(() => (pending.timeout(), this.sendToHost(jsonFrame(streamId, FrameType.Error, { message: 'timeout' }))), HEAD_TIMEOUT_MS);
    request.signal.addEventListener('abort', () => (clearTimeout(timer), forget(), this.sendToHost(jsonFrame(streamId, FrameType.Error, { message: 'cancelled' }))));
    this.sendToHost(jsonFrame(streamId, FrameType.ReqHead, { method: request.method, path: url.pathname + url.search, headers } satisfies ReqHead));
    void this.pumpBody(request, streamId);
    return response.finally(() => clearTimeout(timer));
  }

  private async pumpBody(request: Request, streamId: number) {
    const reader = request.body?.getReader();
    while (reader) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      for (let at = 0; at < value.length; at += BODY_CHUNK) {
        this.sendToHost(bytesFrame(streamId, FrameType.ReqBody, value.subarray(at, at + BODY_CHUNK)));
      }
    }
    this.sendToHost(emptyFrame(streamId, FrameType.ReqEnd));
  }

  async webSocketMessage(socket: WebSocket, message: ArrayBuffer | string) {
    const attachment = socket.deserializeAttachment() as Attachment;
    if (attachment.host) {
      typeof message === 'string' || this.fromHost(message);
      return;
    }
    const { streamId } = attachment;
    this.sendToHost(typeof message === 'string' ? textFrame(streamId, message) : bytesFrame(streamId, FrameType.WsBinary, new Uint8Array(message)));
  }

  private fromHost(message: ArrayBuffer) {
    const frame = decodeFrame(message);
    if (!frame) {
      return;
    }
    const pending = this.pending.get(frame.streamId);
    const socket = this.ctx.getWebSockets(streamTag(frame.streamId))[0];
    const handlers: Partial<Record<FrameType, () => void>> = {
      [FrameType.ResHead]: () => pending?.head(jsonOf<ResHead>(frame) ?? { status: 502, headers: {} }),
      [FrameType.ResBody]: () => pending?.body(frame.payload),
      [FrameType.ResEnd]: () => (pending?.end(), this.pending.delete(frame.streamId)),
      [FrameType.Error]: () => this.streamFailed(frame),
      [FrameType.WsText]: () => socket?.send(textOf(frame.payload) ?? ''),
      [FrameType.WsBinary]: () => socket?.send(frame.payload),
      [FrameType.WsClose]: () => socket && this.closeFromHost(socket, jsonOf<WsClose>(frame)),
      [FrameType.Kick]: () => this.kick(jsonOf<Kick>(frame)),
      [FrameType.Role]: () => this.setRole(jsonOf<Roled>(frame)),
      [FrameType.Close]: () => this.close()
    };
    handlers[frame.type]?.();
  }

  private streamFailed(frame: Frame) {
    const pending = this.pending.get(frame.streamId);
    pending?.fail(jsonOf<ErrorBody>(frame)?.message ?? 'host error');
    this.pending.delete(frame.streamId);
  }

  private closeFromHost(socket: WebSocket, close: WsClose | null) {
    socket.close(safeCode(close?.code ?? CloseCode.Normal), close?.reason ?? '');
  }

  private async kick(kick: Kick | null) {
    if (!kick?.userId) {
      return;
    }
    const kicked = (await this.ctx.storage.get<string[]>(Key.Kicked)) ?? [];
    await this.ctx.storage.put(Key.Kicked, [...kicked, kick.userId]);
    const sockets = this.ctx.getWebSockets(userTag(kick.userId));
    sockets.forEach((socket) => socket.close(CloseCode.Kicked, 'removed by the host'));
  }

  private async setRole(change: Roled | null) {
    if (!change?.userId || !VISITOR_ROLES.includes(change.role)) {
      return;
    }
    const roles = (await this.ctx.storage.get<Record<string, VisitorRole>>(Key.Roles)) ?? {};
    await this.ctx.storage.put(Key.Roles, { ...roles, [change.userId]: change.role });
    for (const socket of this.ctx.getWebSockets(userTag(change.userId))) {
      const attachment = socket.deserializeAttachment() as Attachment;
      attachment.host || socket.serializeAttachment({ ...attachment, visitor: { ...attachment.visitor, role: change.role } } satisfies Attachment);
    }
    this.announce();
  }

  private async close() {
    await this.ctx.storage.put(Key.Closed, true);
    await this.ctx.storage.deleteAlarm();
    this.pending.forEach((pending) => pending.fail('the session is closed'));
    this.pending.clear();
    this.visitorSockets().forEach((socket) => socket.close(CloseCode.Closed, 'the session is closed'));
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string) {
    const attachment = socket.deserializeAttachment() as Attachment | null;
    if (!attachment) {
      return;
    }
    if (attachment.host) {
      this.hostClosed(socket);
      return;
    }
    await this.visitorClosed(socket, attachment.streamId, code, reason);
  }

  async webSocketError(socket: WebSocket) {
    await this.webSocketClose(socket, CloseCode.GoingAway, 'error');
  }

  private async visitorClosed(socket: WebSocket, streamId: number, code: number, reason: string) {
    this.sendToHost(jsonFrame(streamId, FrameType.WsClose, { code, reason } satisfies WsClose));
    this.announce([socket]);
    await this.markPresence(this.visitorSockets([socket]).length > 0);
  }

  private hostClosed(socket: WebSocket) {
    if (this.hostSocket(socket)) {
      return;
    }
    this.pending.forEach((pending) => pending.fail('the host left'));
    this.pending.clear();
    this.visitorSockets().forEach((visitor) => visitor.close(CloseCode.HostGone, 'the host left'));
  }

  async alarm() {
    const expMs = await this.ctx.storage.get<number>(Key.Exp);
    const emptySince = (await this.ctx.storage.get<number>(Key.Empty)) ?? null;
    if (expMs === undefined) {
      return;
    }
    const deadline = deadlineOf({ expMs, emptySince });
    if (Date.now() < deadline.at) {
      await this.ctx.storage.setAlarm(deadline.at);
      return;
    }
    const hostCode = deadline.why === Deadline.Idle ? CloseCode.Idle : CloseCode.Expired;
    this.ctx.getWebSockets(Tag.Host).forEach((socket) => socket.close(hostCode, deadline.why));
    this.visitorSockets().forEach((socket) => socket.close(CloseCode.GoingAway, deadline.why));
    this.pending.forEach((pending) => pending.fail(deadline.why));
    this.pending.clear();
  }
}
