import { PROFILE_PEAK, lensProfile } from './model';

export const LENS_MAP_SIZE = 128;
const NEUTRAL = 0.5;
const BYTE = 255;
const STORED_BLOCK_MAX = 65535;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const RGBA_8BIT = [8, 6, 0, 0, 0];
const ZLIB_HEADER = [0x78, 0x01];

export type LensPixel = { r: number; g: number; a: number };

export function lensPixel(u: number, v: number, edge: number): LensPixel {
  const rho = Math.hypot(u, v);
  const a = Math.min(Math.max((1 - rho) / edge + NEUTRAL, 0), 1);
  if (rho === 0) {
    return { r: NEUTRAL, g: NEUTRAL, a };
  }
  const push = lensProfile(rho) / PROFILE_PEAK / rho;
  return { r: NEUTRAL + NEUTRAL * u * push, g: NEUTRAL + NEUTRAL * v * push, a };
}

function lensPixels(size: number): Uint8Array {
  const rows = new Uint8Array(size * (size * 4 + 1));
  const edge = 2 / size;
  let at = 0;
  for (let y = 0; y < size; y++) {
    rows[at++] = 0;
    for (let x = 0; x < size; x++) {
      const p = lensPixel(((x + NEUTRAL) / size) * 2 - 1, ((y + NEUTRAL) / size) * 2 - 1, edge);
      rows[at++] = Math.round(p.r * BYTE);
      rows[at++] = Math.round(p.g * BYTE);
      rows[at++] = Math.round(NEUTRAL * BYTE);
      rows[at++] = Math.round(p.a * BYTE);
    }
  }
  return rows;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(bytes: number[]): number {
  let c = 0xffffffff;
  for (const b of bytes) {
    c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

function chunk(type: string, data: number[]): number[] {
  const body = [...type].map((c) => c.charCodeAt(0)).concat(data);
  return [...u32(data.length), ...body, ...u32(crc32(body))];
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const d of data) {
    a = (a + d) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function storedZlib(data: Uint8Array): number[] {
  const out = [...ZLIB_HEADER];
  for (let at = 0; at < data.length || at === 0; at += STORED_BLOCK_MAX) {
    const block = data.subarray(at, at + STORED_BLOCK_MAX);
    const last = at + STORED_BLOCK_MAX >= data.length ? 1 : 0;
    out.push(last, block.length & 0xff, block.length >>> 8, ~block.length & 0xff, (~block.length >>> 8) & 0xff);
    for (const b of block) {
      out.push(b);
    }
  }
  return [...out, ...u32(adler32(data))];
}

export function lensMapPng(size = LENS_MAP_SIZE): Uint8Array {
  const header = [...u32(size), ...u32(size), ...RGBA_8BIT];
  return Uint8Array.from([...PNG_SIGNATURE, ...chunk('IHDR', header), ...chunk('IDAT', storedZlib(lensPixels(size))), ...chunk('IEND', [])]);
}

let cached: string | null = null;

export function lensMapUrl(): string {
  if (cached) {
    return cached;
  }
  const png = lensMapPng();
  let binary = '';
  for (const b of png) {
    binary += String.fromCharCode(b);
  }
  cached = `data:image/png;base64,${btoa(binary)}`;
  return cached;
}
