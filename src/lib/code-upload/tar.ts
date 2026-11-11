import { strFromU8, strToU8 } from 'fflate';

const BLOCK = 512;
const NAME_MAX = 100;
const PREFIX_MAX = 155;
const FILE_MODE = '0000644';
const REGULAR = '0';
const OCTAL = 8;

export type TarFile = { path: string; bytes: Uint8Array };

const padded = (n: number) => Math.ceil(n / BLOCK) * BLOCK;

function put(header: Uint8Array, at: number, width: number, text: string) {
  header.set(strToU8(text).subarray(0, width), at);
}

const octal = (n: number, width: number) => `${n.toString(OCTAL).padStart(width - 1, '0')}\0`;

function split(path: string): [string, string] | null {
  if (path.length <= NAME_MAX) {
    return ['', path];
  }
  const cut = path.lastIndexOf('/', PREFIX_MAX);
  const name = cut > 0 ? path.slice(cut + 1) : '';
  return cut > 0 && name.length <= NAME_MAX ? [path.slice(0, cut), name] : null;
}

export const fitsTar = (path: string) => split(path) !== null;

function headerOf(path: string, size: number): Uint8Array {
  const [prefix, name] = split(path)!;
  const header = new Uint8Array(BLOCK);
  put(header, 0, NAME_MAX, name);
  put(header, 100, 8, `${FILE_MODE}\0`);
  put(header, 108, 8, octal(0, 8));
  put(header, 116, 8, octal(0, 8));
  put(header, 124, 12, octal(size, 12));
  put(header, 136, 12, octal(0, 12));
  put(header, 148, 8, '        ');
  put(header, 156, 1, REGULAR);
  put(header, 257, 8, 'ustar\u000000');
  put(header, 345, PREFIX_MAX, prefix);
  const sum = header.reduce((a, b) => a + b, 0);
  put(header, 148, 8, `${sum.toString(OCTAL).padStart(6, '0')}\0 `);
  return header;
}

export function tarOf(files: TarFile[]): Uint8Array {
  const total = files.reduce((n, f) => n + BLOCK + padded(f.bytes.length), 2 * BLOCK);
  const out = new Uint8Array(total);
  let at = 0;
  for (const f of files) {
    out.set(headerOf(f.path, f.bytes.length), at);
    out.set(f.bytes, at + BLOCK);
    at += BLOCK + padded(f.bytes.length);
  }
  return out;
}

const text = (block: Uint8Array, at: number, width: number) => strFromU8(block.subarray(at, at + width)).replace(/\0.*$/s, '');

export function untarred(tar: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  let at = 0;
  while (at + BLOCK <= tar.length) {
    const header = tar.subarray(at, at + BLOCK);
    const name = text(header, 0, NAME_MAX);
    if (!name) {
      break;
    }
    const size = parseInt(text(header, 124, 12).trim() || '0', OCTAL);
    const prefix = text(header, 345, PREFIX_MAX);
    const full = prefix ? `${prefix}/${name}` : name;
    const inner = full.split('/').slice(1).join('/');
    if (text(header, 156, 1) === REGULAR && inner) {
      files.set(inner, tar.slice(at + BLOCK, at + BLOCK + size));
    }
    at += BLOCK + padded(size);
  }
  return files;
}
