import { readFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'fflate';
import { decompress } from 'fzstd';
import { compileSchema, decodeBinarySchema } from 'kiwi-schema';

const HEADER = 'fig-kiwi';
const HEADER_BYTES = HEADER.length + 4;
const FIGMA_PART = /\(figma\)([A-Za-z0-9+/=]+)\(\/figma\)/;
const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];
const GHOST_ORANGE = { r: 0.9921568627450981, g: 0.3686274509803922, b: 0.1607843137254902 };

type Paint = { type: string; color?: { r: number; g: number; b: number }; opacity?: number; visible?: boolean; image?: { hash: Uint8Array } };
type Node = { fillPaints?: Paint[] };

const clip = readFileSync(new URL('./clip-1.html', import.meta.url), 'utf8');

const unpacked = (chunk: Uint8Array) => (ZSTD_MAGIC.every((b, i) => chunk[i] === b) ? decompress(chunk) : inflateSync(chunk));

function chunksOf(archive: Uint8Array): Uint8Array[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const chunks: Uint8Array[] = [];
  let at = HEADER_BYTES;
  while (at + 4 <= archive.length) {
    const length = view.getUint32(at, true);
    chunks.push(archive.subarray(at + 4, at + 4 + length));
    at += 4 + length;
  }
  return chunks;
}

function archiveOf(version: Uint8Array, chunks: Uint8Array[]): Uint8Array {
  const parts = [new TextEncoder().encode(HEADER), version, ...chunks.flatMap((c) => [new Uint8Array(new Uint32Array([c.length]).buffer), c])];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((at, p) => (out.set(p, at), at + p.length), 0);
  return out;
}

export const hashBytes = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));

export const FIGMA_FILE_KEY = JSON.parse(Buffer.from(/\(figmeta\)([A-Za-z0-9+/=]+)\(\/figmeta\)/.exec(clip)![1], 'base64').toString('utf8')).fileKey as string;

export function figmaClipWithImage(hashHex: string): string {
  const archive = Uint8Array.from(Buffer.from(FIGMA_PART.exec(clip)![1], 'base64'));
  const [schemaChunk, dataChunk] = chunksOf(archive);
  const schema = compileSchema(decodeBinarySchema(unpacked(schemaChunk)));
  const message = schema.decodeMessage(unpacked(dataChunk)) as { nodeChanges: Node[] };
  const ghost = message.nodeChanges.find((n) => n.fillPaints?.some((p) => p.type === 'SOLID' && p.color && Math.abs(p.color.r - GHOST_ORANGE.r) < 0.01 && Math.abs(p.color.g - GHOST_ORANGE.g) < 0.01));
  if (!ghost?.fillPaints) {
    throw new Error('the fixture has no orange shape to turn into an image');
  }
  ghost.fillPaints = ghost.fillPaints.map((p) => (p.type === 'SOLID' ? { type: 'IMAGE', opacity: 1, visible: true, image: { hash: hashBytes(hashHex) } } : p));
  const rebuilt = archiveOf(archive.subarray(HEADER.length, HEADER_BYTES), [schemaChunk, deflateSync(schema.encodeMessage(message))]);
  return clip.replace(FIGMA_PART, `(figma)${Buffer.from(rebuilt).toString('base64')}(/figma)`);
}
