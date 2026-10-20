import { brotliDecompressSync, inflateSync } from 'node:zlib';

export type FontMeta = { family: string; weight: number; italic: boolean };

type Tables = Map<string, Uint8Array>;

const REGULAR = 400;
const MAX_FAMILY = 60;
const NAME_FAMILY = 1;
const NAME_TYPOGRAPHIC_FAMILY = 16;
const PLATFORM_MAC = 1;
const PLATFORM_WINDOWS = 3;
const OS2_WEIGHT_AT = 4;
const OS2_SELECTION_AT = 62;
const ITALIC_BIT = 1;
const UNSAFE_NAME = /[^A-Za-z0-9 \-.']+/g;

const WOFF_HEADER = 44;
const WOFF_ENTRY = 20;
const SFNT_HEADER = 12;
const SFNT_ENTRY = 16;
const WOFF2_HEADER = 48;
const WOFF2_CUSTOM_TAG = 0x3f;
const WOFF2_GLYF = 10;
const WOFF2_LOCA = 11;
const WOFF2_TAGS: Record<number, string> = { 1: 'head', 5: 'name', 6: 'OS/2' };

const tagAt = (view: DataView, at: number) => String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));

const viewOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

function sfntTables(bytes: Uint8Array): Tables {
  const view = viewOf(bytes);
  const tables: Tables = new Map();
  for (let i = 0; i < view.getUint16(4); i++) {
    const at = SFNT_HEADER + i * SFNT_ENTRY;
    const offset = view.getUint32(at + 8);
    tables.set(tagAt(view, at), bytes.subarray(offset, offset + view.getUint32(at + 12)));
  }
  return tables;
}

function woffTables(bytes: Uint8Array): Tables {
  const view = viewOf(bytes);
  const tables: Tables = new Map();
  for (let i = 0; i < view.getUint16(12); i++) {
    const at = WOFF_HEADER + i * WOFF_ENTRY;
    const offset = view.getUint32(at + 4);
    const packed = bytes.subarray(offset, offset + view.getUint32(at + 8));
    tables.set(tagAt(view, at), packed.length < view.getUint32(at + 12) ? new Uint8Array(inflateSync(packed)) : packed);
  }
  return tables;
}

function woff2Tables(bytes: Uint8Array): Tables {
  const view = viewOf(bytes);
  let at = WOFF2_HEADER;
  const base128 = () => {
    let n = 0;
    for (;;) {
      const b = view.getUint8(at++);
      n = n * 128 + (b & 0x7f);
      if (!(b & 0x80)) {
        return n;
      }
    }
  };
  const entries: { tag: string; length: number }[] = [];
  for (let i = 0; i < view.getUint16(12); i++) {
    const flags = view.getUint8(at++);
    const index = flags & WOFF2_CUSTOM_TAG;
    const tag = index === WOFF2_CUSTOM_TAG ? tagAt(view, (at += 4) - 4) : (WOFF2_TAGS[index] ?? `#${index}`);
    const original = base128();
    const version = flags >> 6;
    const transformed = index === WOFF2_GLYF || index === WOFF2_LOCA ? version === 0 : version !== 0;
    entries.push({ tag, length: transformed ? base128() : original });
  }
  const stream = new Uint8Array(brotliDecompressSync(bytes.subarray(at)));
  const tables: Tables = new Map();
  let offset = 0;
  for (const entry of entries) {
    tables.set(entry.tag, stream.subarray(offset, offset + entry.length));
    offset += entry.length;
  }
  return tables;
}

const READERS: Record<string, (bytes: Uint8Array) => Tables> = {
  wOFF: woffTables,
  wOF2: woff2Tables,
  OTTO: sfntTables,
  true: sfntTables,
  '\u0000\u0001\u0000\u0000': sfntTables
};

function decoded(bytes: Uint8Array, platform: number): string {
  if (platform !== PLATFORM_WINDOWS) {
    return String.fromCharCode(...bytes);
  }
  const view = viewOf(bytes);
  return Array.from({ length: bytes.length >> 1 }, (_, i) => String.fromCharCode(view.getUint16(i * 2))).join('');
}

function names(table: Uint8Array): Map<number, string> {
  const view = viewOf(table);
  const strings = view.getUint16(4);
  const found = new Map<number, { text: string; platform: number }>();
  for (let i = 0; i < view.getUint16(2); i++) {
    const at = 6 + i * 12;
    const platform = view.getUint16(at);
    if (platform !== PLATFORM_WINDOWS && platform !== PLATFORM_MAC) {
      continue;
    }
    const id = view.getUint16(at + 6);
    if (found.get(id)?.platform === PLATFORM_WINDOWS) {
      continue;
    }
    const start = strings + view.getUint16(at + 10);
    found.set(id, { text: decoded(table.subarray(start, start + view.getUint16(at + 8)), platform), platform });
  }
  return new Map([...found].map(([id, n]) => [id, n.text]));
}

const cleanFamily = (raw: string) => raw.replace(UNSAFE_NAME, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_FAMILY).trim();

function metaOf(tables: Tables): FontMeta | null {
  const name = tables.get('name');
  if (!name) {
    return null;
  }
  const found = names(name);
  const family = cleanFamily(found.get(NAME_TYPOGRAPHIC_FAMILY) ?? found.get(NAME_FAMILY) ?? '');
  if (!family) {
    return null;
  }
  const os2 = tables.get('OS/2');
  if (!os2 || os2.length < OS2_SELECTION_AT + 2) {
    return { family, weight: REGULAR, italic: false };
  }
  const view = viewOf(os2);
  return { family, weight: view.getUint16(OS2_WEIGHT_AT) || REGULAR, italic: (view.getUint16(OS2_SELECTION_AT) & ITALIC_BIT) === ITALIC_BIT };
}

export function readFontMeta(bytes: Uint8Array): FontMeta | null {
  const read = bytes.length >= 4 ? READERS[String.fromCharCode(...bytes.subarray(0, 4))] : undefined;
  if (!read) {
    return null;
  }
  try {
    return metaOf(read(bytes));
  } catch {
    return null;
  }
}
