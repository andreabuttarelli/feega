import { brotliCompressSync, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readFontMeta } from './font-meta';

type Table = { tag: string; data: Uint8Array };

const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const utf16 = (s: string) => [...s].flatMap((c) => u16(c.charCodeAt(0)));

function nameTable(names: Record<number, string>): Uint8Array {
  const entries = Object.entries(names).map(([id, text]) => ({ id: Number(id), bytes: utf16(text) }));
  const header = 6 + entries.length * 12;
  let offset = 0;
  const records = entries.flatMap((e) => {
    const record = [...u16(3), ...u16(1), ...u16(0x409), ...u16(e.id), ...u16(e.bytes.length), ...u16(offset)];
    offset += e.bytes.length;
    return record;
  });
  return new Uint8Array([...u16(0), ...u16(entries.length), ...u16(header), ...records, ...entries.flatMap((e) => e.bytes)]);
}

function os2Table(weight: number, italic: boolean): Uint8Array {
  const table = new Uint8Array(78);
  table.set(u16(weight), 4);
  table.set(u16(italic ? 1 : 0x40), 62);
  return table;
}

function sfnt(flavor: number[], tables: Table[]): Uint8Array {
  const dir = 12 + tables.length * 16;
  let offset = dir;
  const entries = tables.flatMap((t) => {
    const entry = [...ascii(t.tag), ...u32(0), ...u32(offset), ...u32(t.data.length)];
    offset += t.data.length;
    return entry;
  });
  return new Uint8Array([...flavor, ...u16(tables.length), 0, 0, 0, 0, 0, 0, ...entries, ...tables.flatMap((t) => [...t.data])]);
}

function woff(tables: Table[]): Uint8Array {
  const dir = 44 + tables.length * 20;
  let offset = dir;
  const packed = tables.map((t) => ({ ...t, z: new Uint8Array(deflateSync(t.data)) }));
  const entries = packed.flatMap((t) => {
    const entry = [...ascii(t.tag), ...u32(offset), ...u32(t.z.length), ...u32(t.data.length), ...u32(0)];
    offset += t.z.length;
    return entry;
  });
  const header = [...ascii('wOFF'), ...u32(0x10000), ...u32(offset), ...u16(tables.length), 0, 0, ...new Array(28).fill(0)];
  return new Uint8Array([...header, ...entries, ...packed.flatMap((t) => [...t.z])]);
}

const WOFF2_INDEX: Record<string, number> = { name: 5, 'OS/2': 6 };

function woff2(tables: Table[]): Uint8Array {
  const entries = tables.flatMap((t) => [WOFF2_INDEX[t.tag], ...base128(t.data.length)]);
  const stream = new Uint8Array(brotliCompressSync(new Uint8Array(tables.flatMap((t) => [...t.data]))));
  const header = [...ascii('wOF2'), ...u32(0x10000), ...u32(0), ...u16(tables.length), 0, 0, ...new Array(32).fill(0)];
  return new Uint8Array([...header, ...entries, ...stream]);
}

function base128(n: number): number[] {
  const out = [n & 0x7f];
  for (let rest = n >>> 7; rest; rest >>>= 7) {
    out.unshift((rest & 0x7f) | 0x80);
  }
  return out;
}

const TRUETYPE = u32(0x10000);
const boldItalic = [
  { tag: 'OS/2', data: os2Table(700, true) },
  { tag: 'name', data: nameTable({ 1: 'Acme Grotesk Bold', 2: 'Bold Italic', 16: 'Acme Grotesk' }) }
];

describe('reading a font file', () => {
  it('takes the typographic family, the weight class and the italic bit from a TrueType file', () => {
    expect(readFontMeta(sfnt(TRUETYPE, boldItalic))).toEqual({ family: 'Acme Grotesk', weight: 700, italic: true });
  });

  it('falls back to the legacy family name when there is no typographic one', () => {
    const tables = [{ tag: 'name', data: nameTable({ 1: 'Plain Sans' }) }, { tag: 'OS/2', data: os2Table(400, false) }];
    expect(readFontMeta(sfnt(ascii('OTTO'), tables))).toEqual({ family: 'Plain Sans', weight: 400, italic: false });
  });

  it('reads the same names inside WOFF and WOFF2 wrappers', () => {
    expect(readFontMeta(woff(boldItalic))).toEqual({ family: 'Acme Grotesk', weight: 700, italic: true });
    expect(readFontMeta(woff2(boldItalic))).toEqual({ family: 'Acme Grotesk', weight: 700, italic: true });
  });

  it('cleans a family name into one the video model accepts', () => {
    const tables = [{ tag: 'name', data: nameTable({ 1: '  Weird™ Font/Name  ' }) }];
    expect(readFontMeta(sfnt(TRUETYPE, tables))).toEqual({ family: 'Weird Font Name', weight: 400, italic: false });
  });

  it('gives null for bytes that are not a readable font, never throws', () => {
    expect(readFontMeta(new TextEncoder().encode('<svg></svg>'))).toBeNull();
    expect(readFontMeta(new Uint8Array([0, 1, 0, 0, 0, 9]))).toBeNull();
    expect(readFontMeta(new Uint8Array([...ascii('wOF2'), 1, 2]))).toBeNull();
  });
});
