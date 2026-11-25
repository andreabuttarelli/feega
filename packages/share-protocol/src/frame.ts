export enum FrameType {
  ReqHead = 1,
  ReqBody = 2,
  ReqEnd = 3,
  ResHead = 4,
  ResBody = 5,
  ResEnd = 6,
  WsOpen = 7,
  WsText = 8,
  WsBinary = 9,
  WsClose = 10,
  Error = 11,
  Presence = 12,
  Kick = 13,
  Role = 14,
  Close = 15
}

export enum Payload {
  Json = 'json',
  Bytes = 'bytes',
  Text = 'text',
  Empty = 'empty'
}

export const FRAME_PAYLOADS: Record<FrameType, Payload> = {
  [FrameType.ReqHead]: Payload.Json,
  [FrameType.ReqBody]: Payload.Bytes,
  [FrameType.ReqEnd]: Payload.Empty,
  [FrameType.ResHead]: Payload.Json,
  [FrameType.ResBody]: Payload.Bytes,
  [FrameType.ResEnd]: Payload.Empty,
  [FrameType.WsOpen]: Payload.Json,
  [FrameType.WsText]: Payload.Text,
  [FrameType.WsBinary]: Payload.Bytes,
  [FrameType.WsClose]: Payload.Json,
  [FrameType.Error]: Payload.Json,
  [FrameType.Presence]: Payload.Json,
  [FrameType.Kick]: Payload.Json,
  [FrameType.Role]: Payload.Json,
  [FrameType.Close]: Payload.Empty
};

export type Frame = { streamId: number; type: FrameType; payload: Uint8Array };

export type Headers = Record<string, string>;

export type ReqHead = { method: string; path: string; headers: Headers };
export type ResHead = { status: number; headers: Headers };
export type WsOpen = { path: string; headers: Headers; protocols: string[] };
export type WsClose = { code: number; reason: string };
export type ErrorBody = { message: string };
export type Role = 'host' | 'editor' | 'viewer';
export type VisitorRole = Exclude<Role, 'host'>;
export type VisitorInfo = { userId: string; name: string; role: VisitorRole };
export type Point = { x: number; y: number };
export type Present = VisitorInfo & { selection?: string; cursor?: Point };
export type Presence = { visitors: Present[] };
export type Kick = { userId: string };
export type Roled = { userId: string; role: VisitorRole };

export const SET_COOKIE_SEPARATOR = '\n';
export const HOST_PEER = 'host';
export const CONTROL_STREAM = 0;
export const MAX_STREAM_ID = 0xffffffff;

const HEADER_BYTES = 5;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

const isType = (value: number): value is FrameType => value in FRAME_PAYLOADS;

export function encodeFrame({ streamId, type, payload }: Frame): Uint8Array {
  if (!Number.isInteger(streamId) || streamId < 0 || streamId > MAX_STREAM_ID) {
    throw new RangeError(`stream id ${streamId} is outside u32`);
  }
  const out = new Uint8Array(HEADER_BYTES + payload.length);
  new DataView(out.buffer).setUint32(0, streamId);
  out[4] = type;
  out.set(payload, HEADER_BYTES);
  return out;
}

export function decodeFrame(input: Uint8Array | ArrayBuffer): Frame | null {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < HEADER_BYTES || !isType(bytes[4])) {
    return null;
  }
  const streamId = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  return { streamId, type: bytes[4], payload: bytes.slice(HEADER_BYTES) };
}

export const textOf = (payload: Uint8Array): string | null => {
  try {
    return decoder.decode(payload);
  } catch {
    return null;
  }
};

export const jsonFrame = (streamId: number, type: FrameType, value: unknown): Frame => ({ streamId, type, payload: encoder.encode(JSON.stringify(value)) });

export function jsonOf<T = unknown>(frame: Frame): T | null {
  const text = textOf(frame.payload);
  if (text === null) {
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export const emptyFrame = (streamId: number, type: FrameType): Frame => ({ streamId, type, payload: new Uint8Array() });

export const bytesFrame = (streamId: number, type: FrameType, payload: Uint8Array): Frame => ({ streamId, type, payload });

export const textFrame = (streamId: number, text: string): Frame => ({ streamId, type: FrameType.WsText, payload: encoder.encode(text) });
