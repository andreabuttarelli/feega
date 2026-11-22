import { describe, expect, it } from 'vitest';
import { CONTROL_STREAM, FRAME_PAYLOADS, FrameType, Payload, decodeFrame, encodeFrame, jsonFrame, jsonOf, MAX_STREAM_ID } from './frame';

const bytes = (...values: number[]) => new Uint8Array(values);

describe('frame', () => {
  it('encodes the stream id big endian, then the type, then the payload', () => {
    const encoded = encodeFrame({ streamId: 0x01020304, type: FrameType.ResBody, payload: bytes(9, 8) });

    expect([...encoded]).toEqual([1, 2, 3, 4, 5, 9, 8]);
  });

  it('round-trips every frame type', () => {
    for (const type of Object.values(FrameType).filter((t): t is FrameType => typeof t === 'number')) {
      const frame = { streamId: 77, type, payload: bytes(1, 2, 3) };

      expect(decodeFrame(encodeFrame(frame))).toEqual(frame);
    }
  });

  it('keeps the largest stream id intact', () => {
    const frame = { streamId: MAX_STREAM_ID, type: FrameType.ReqEnd, payload: bytes() };

    expect(decodeFrame(encodeFrame(frame))?.streamId).toBe(MAX_STREAM_ID);
  });

  it('decodes an ArrayBuffer and a sliced view alike', () => {
    const encoded = encodeFrame({ streamId: 5, type: FrameType.WsBinary, payload: bytes(4, 4) });
    const padded = new Uint8Array(encoded.length + 3);
    padded.set(encoded, 3);

    expect(decodeFrame(padded.buffer.slice(3))?.payload).toEqual(bytes(4, 4));
    expect(decodeFrame(padded.subarray(3))?.payload).toEqual(bytes(4, 4));
  });

  it('rejects a frame shorter than its header', () => {
    expect(decodeFrame(bytes(0, 0, 0, 1))).toBeNull();
    expect(decodeFrame(bytes())).toBeNull();
  });

  it('rejects an unknown type', () => {
    expect(decodeFrame(bytes(0, 0, 0, 1, 99))).toBeNull();
    expect(decodeFrame(bytes(0, 0, 0, 1, 0))).toBeNull();
  });

  it('refuses to encode a stream id outside u32', () => {
    expect(() => encodeFrame({ streamId: -1, type: FrameType.ReqEnd, payload: bytes() })).toThrow();
    expect(() => encodeFrame({ streamId: MAX_STREAM_ID + 1, type: FrameType.ReqEnd, payload: bytes() })).toThrow();
    expect(() => encodeFrame({ streamId: 1.5, type: FrameType.ReqEnd, payload: bytes() })).toThrow();
  });

  it('declares how each type carries its payload', () => {
    expect(FRAME_PAYLOADS[FrameType.ReqHead]).toBe(Payload.Json);
    expect(FRAME_PAYLOADS[FrameType.ReqBody]).toBe(Payload.Bytes);
    expect(FRAME_PAYLOADS[FrameType.ReqEnd]).toBe(Payload.Empty);
    expect(FRAME_PAYLOADS[FrameType.ResHead]).toBe(Payload.Json);
    expect(FRAME_PAYLOADS[FrameType.ResBody]).toBe(Payload.Bytes);
    expect(FRAME_PAYLOADS[FrameType.ResEnd]).toBe(Payload.Empty);
    expect(FRAME_PAYLOADS[FrameType.WsOpen]).toBe(Payload.Json);
    expect(FRAME_PAYLOADS[FrameType.WsText]).toBe(Payload.Text);
    expect(FRAME_PAYLOADS[FrameType.WsBinary]).toBe(Payload.Bytes);
    expect(FRAME_PAYLOADS[FrameType.WsClose]).toBe(Payload.Json);
    expect(FRAME_PAYLOADS[FrameType.Error]).toBe(Payload.Json);
    expect(FRAME_PAYLOADS[FrameType.Presence]).toBe(Payload.Json);
    expect(FRAME_PAYLOADS[FrameType.Kick]).toBe(Payload.Json);
    expect(FRAME_PAYLOADS[FrameType.Role]).toBe(Payload.Json);
    expect(FRAME_PAYLOADS[FrameType.Close]).toBe(Payload.Empty);
  });

  it('numbers the types as the contract does', () => {
    expect(FrameType.ReqHead).toBe(1);
    expect(FrameType.WsOpen).toBe(7);
    expect(FrameType.Presence).toBe(12);
    expect(FrameType.Kick).toBe(13);
    expect(FrameType.Role).toBe(14);
    expect(FrameType.Close).toBe(15);
  });

  it('carries json payloads including non-ascii text', () => {
    const frame = jsonFrame(3, FrameType.ResHead, { status: 200, headers: { 'x-name': 'è🙂' } });

    expect(jsonOf(decodeFrame(encodeFrame(frame))!)).toEqual({ status: 200, headers: { 'x-name': 'è🙂' } });
  });

  it('returns null for a payload that is not json', () => {
    expect(jsonOf({ streamId: 1, type: FrameType.ResHead, payload: bytes(0xff, 0x01) })).toBeNull();
  });

  it('reserves stream 0 for control frames', () => {
    expect(CONTROL_STREAM).toBe(0);
  });
});
