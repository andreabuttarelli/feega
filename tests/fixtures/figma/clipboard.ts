import { readFileSync } from 'node:fs';
import { decompress } from 'fzstd';
import { deflateSync, inflateSync } from 'fflate';
import { compileSchema, decodeBinarySchema } from 'kiwi-schema';
import type { FigmaMessage } from '../../../src/lib/canvas/figma/archive';

const HEADER = 'fig-kiwi';
const VERSION = 70;
const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];
const FIGMA = /\(figma\)([A-Za-z0-9+/=]+)\(\/figma\)/;

const real = readFileSync(new URL('./clip-1.html', import.meta.url), 'utf8');

const unpacked = (chunk: Uint8Array) => (ZSTD_MAGIC.every((b, i) => chunk[i] === b) ? decompress(chunk) : inflateSync(chunk));

function chunksOf(archive: Uint8Array): Uint8Array[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const chunks: Uint8Array[] = [];
  for (let at = HEADER.length + 4; at + 4 <= archive.length; ) {
    const length = view.getUint32(at, true);
    chunks.push(archive.subarray(at + 4, at + 4 + length));
    at += 4 + length;
  }
  return chunks;
}

function framed(chunks: Uint8Array[]): Uint8Array {
  const total = HEADER.length + 4 + chunks.reduce((n, c) => n + 4 + c.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out.set(new TextEncoder().encode(HEADER));
  view.setUint32(HEADER.length, VERSION, true);
  let at = HEADER.length + 4;
  for (const chunk of chunks) {
    view.setUint32(at, chunk.length, true);
    out.set(chunk, at + 4);
    at += 4 + chunk.length;
  }
  return out;
}

const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

export function figmaClipboardHtml(message: FigmaMessage): string {
  const code = real.match(FIGMA)![1];
  const archive = Uint8Array.from(atob(code), (c) => c.charCodeAt(0));
  const [schemaChunk] = chunksOf(archive);
  const schemaBytes = unpacked(schemaChunk);
  const schema = compileSchema(decodeBinarySchema(schemaBytes)) as { encodeMessage: (m: unknown) => Uint8Array };
  const data = schema.encodeMessage({ type: 'NODE_CHANGES', sessionID: 0, ackID: 0, nodeChanges: message.nodes, blobs: message.blobs.map((bytes) => ({ bytes })) });
  const html = framed([deflateSync(schemaBytes), deflateSync(data)]);
  const meta = btoa(JSON.stringify({ fileKey: 'synthetic', pasteID: 1, dataType: 'scene' }));
  return `<meta charset="utf-8"><span data-metadata="<!--(figmeta)${meta}(/figmeta)-->"></span><span data-buffer="<!--(figma)${base64(html)}(/figma)-->"></span>`;
}
