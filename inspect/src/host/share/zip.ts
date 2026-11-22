export type ZipEntry = { name: string; data: Uint8Array };

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_RECORD = 0x06054b50;
const VERSION = 20;
const UTF8_FLAG = 0x0800;
const STORED = 0;
const LOCAL_FIXED = 30;
const CENTRAL_FIXED = 46;
const END_FIXED = 22;
const CRC_POLY = 0xedb88320;
const BYTE_VALUES = 256;
const BITS = 8;

const TABLE = Array.from({ length: BYTE_VALUES }, (_, n) => {
  let c = n;
  for (let bit = 0; bit < BITS; bit++) {
    c = c & 1 ? CRC_POLY ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = TABLE[(crc ^ byte) & 0xff] ^ (crc >>> BITS);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function zipOf(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const named = entries.map((entry) => ({ ...entry, nameBytes: encoder.encode(entry.name), crc: crc32(entry.data) }));
  const localSize = named.reduce((sum, e) => sum + LOCAL_FIXED + e.nameBytes.length + e.data.length, 0);
  const centralSize = named.reduce((sum, e) => sum + CENTRAL_FIXED + e.nameBytes.length, 0);
  const out = new Uint8Array(localSize + centralSize + END_FIXED);
  const view = new DataView(out.buffer);
  let at = 0;
  const offsets: number[] = [];

  for (const e of named) {
    offsets.push(at);
    view.setUint32(at, LOCAL_HEADER, true);
    view.setUint16(at + 4, VERSION, true);
    view.setUint16(at + 6, UTF8_FLAG, true);
    view.setUint16(at + 8, STORED, true);
    view.setUint32(at + 14, e.crc, true);
    view.setUint32(at + 18, e.data.length, true);
    view.setUint32(at + 22, e.data.length, true);
    view.setUint16(at + 26, e.nameBytes.length, true);
    out.set(e.nameBytes, at + LOCAL_FIXED);
    out.set(e.data, at + LOCAL_FIXED + e.nameBytes.length);
    at += LOCAL_FIXED + e.nameBytes.length + e.data.length;
  }

  named.forEach((e, i) => {
    view.setUint32(at, CENTRAL_HEADER, true);
    view.setUint16(at + 4, VERSION, true);
    view.setUint16(at + 6, VERSION, true);
    view.setUint16(at + 8, UTF8_FLAG, true);
    view.setUint16(at + 10, STORED, true);
    view.setUint32(at + 16, e.crc, true);
    view.setUint32(at + 20, e.data.length, true);
    view.setUint32(at + 24, e.data.length, true);
    view.setUint16(at + 28, e.nameBytes.length, true);
    view.setUint32(at + 42, offsets[i], true);
    out.set(e.nameBytes, at + CENTRAL_FIXED);
    at += CENTRAL_FIXED + e.nameBytes.length;
  });

  view.setUint32(at, END_RECORD, true);
  view.setUint16(at + 8, named.length, true);
  view.setUint16(at + 10, named.length, true);
  view.setUint32(at + 12, centralSize, true);
  view.setUint32(at + 16, localSize, true);
  return out;
}
