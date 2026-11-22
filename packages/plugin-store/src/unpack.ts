import { gunzipSync } from 'node:zlib';

const BLOCK = 512;
const NAME_AT = 0;
const NAME_LENGTH = 100;
const SIZE_AT = 124;
const SIZE_LENGTH = 12;
const TYPE_AT = 156;
const PREFIX_AT = 345;
const PREFIX_LENGTH = 155;
const OCTAL = 8;
const MAX_UNPACKED_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 2000;
const FILE_TYPES = new Set(['0', '\0']);

const textAt = (block: Buffer, at: number, length: number) => block.toString('utf8', at, at + length).split('\0')[0];

function unpackedBytes(archive: Uint8Array): Buffer {
  try {
    return gunzipSync(archive, { maxOutputLength: MAX_UNPACKED_BYTES });
  } catch {
    throw new Error('the download is not a valid plugin archive');
  }
}

function inside(path: string): string {
  const parts = path.split('/').slice(1);
  if (parts.some((part) => part === '..' || part.includes('\\')) || path.startsWith('/')) {
    throw new Error(`unsafe path in the archive: ${path}`);
  }
  return parts.filter((part) => part !== '' && part !== '.').join('/');
}

export function unpack(archive: Uint8Array): Map<string, Buffer> {
  const tar = unpackedBytes(archive);
  const files = new Map<string, Buffer>();
  let at = 0;

  while (at + BLOCK <= tar.length) {
    const header = tar.subarray(at, at + BLOCK);
    const name = textAt(header, NAME_AT, NAME_LENGTH);
    if (name === '') {
      break;
    }
    const size = parseInt(textAt(header, SIZE_AT, SIZE_LENGTH).trim() || '0', OCTAL);
    const start = at + BLOCK;
    at = start + Math.ceil(size / BLOCK) * BLOCK;
    if (!FILE_TYPES.has(String.fromCharCode(header[TYPE_AT]))) {
      continue;
    }
    const prefix = textAt(header, PREFIX_AT, PREFIX_LENGTH);
    const path = inside(prefix ? `${prefix}/${name}` : name);
    if (path === '') {
      continue;
    }
    if (files.size >= MAX_FILES) {
      throw new Error('the archive holds too many files');
    }
    files.set(path, Buffer.from(tar.subarray(start, start + size)));
  }

  return files;
}
