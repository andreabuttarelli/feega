import type { StereoBuffer } from './render';

export const WAV_MIME = 'audio/wav';

const HEADER = 44;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;
const PCM = 1;
const BITS = 16;
const FULL_SCALE = 0x7fff;

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export function encodeWav(buffer: StereoBuffer): Uint8Array {
  const frames = buffer.left.length;
  const data = frames * CHANNELS * BYTES_PER_SAMPLE;
  const bytes = new Uint8Array(HEADER + data);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));

  text(0, 'RIFF');
  view.setUint32(4, HEADER - 8 + data, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, PCM, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(32, CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(34, BITS, true);
  text(36, 'data');
  view.setUint32(40, data, true);

  for (let i = 0; i < frames; i++) {
    const at = HEADER + i * CHANNELS * BYTES_PER_SAMPLE;
    view.setInt16(at, Math.round(clamp(buffer.left[i]) * FULL_SCALE), true);
    view.setInt16(at + BYTES_PER_SAMPLE, Math.round(clamp(buffer.right[i]) * FULL_SCALE), true);
  }
  return bytes;
}

export function decodeWav(bytes: Uint8Array): StereoBuffer {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const frames = view.getUint32(40, true) / (CHANNELS * BYTES_PER_SAMPLE);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const at = HEADER + i * CHANNELS * BYTES_PER_SAMPLE;
    left[i] = view.getInt16(at, true) / FULL_SCALE;
    right[i] = view.getInt16(at + BYTES_PER_SAMPLE, true) / FULL_SCALE;
  }
  return { sampleRate: view.getUint32(24, true), left, right };
}
