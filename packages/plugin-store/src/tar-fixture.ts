import { gzipSync } from 'node:zlib';

const BLOCK = 512;
const NAME_AT = 0;
const NAME_LENGTH = 100;
const MODE_AT = 100;
const SIZE_AT = 124;
const SIZE_LENGTH = 12;
const SUM_AT = 148;
const SUM_LENGTH = 8;
const TYPE_AT = 156;
const OCTAL = 8;
const REGULAR = '0';
const GLOBAL_HEADER = 'g';

function entry(name: string, body: Buffer, type: string): Buffer {
  const header = Buffer.alloc(BLOCK);
  header.write(name.slice(0, NAME_LENGTH), NAME_AT);
  header.write('0000644\0', MODE_AT);
  header.write(`${body.length.toString(OCTAL).padStart(SIZE_LENGTH - 1, '0')}\0`, SIZE_AT);
  header.write(type, TYPE_AT);
  header.fill(' ', SUM_AT, SUM_AT + SUM_LENGTH);
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${sum.toString(OCTAL).padStart(6, '0')}\0 `, SUM_AT);
  const padding = Buffer.alloc((BLOCK - (body.length % BLOCK)) % BLOCK);
  return Buffer.concat([header, body, padding]);
}

export function tarball(files: Record<string, string>, top = 'package'): Buffer {
  const entries = [entry('pax_global_header', Buffer.alloc(0), GLOBAL_HEADER), ...Object.entries(files).map(([path, text]) => entry(top ? `${top}/${path}` : path, Buffer.from(text), REGULAR))];
  return gzipSync(Buffer.concat([...entries, Buffer.alloc(BLOCK * 2)]));
}
