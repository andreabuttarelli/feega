import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { crc32 } from 'node:zlib';
import sharp from 'sharp';
import { env } from '$env/dynamic/private';
import { ensureFfmpegPath } from '$lib/server/ffmpeg-bin';

export const DIGITAL_SOURCE_TYPE = {
  synthetic: 'trainedAlgorithmicMedia',
  composite: 'compositeWithTrainedAlgorithmicMedia'
} as const;

export type DigitalSourceType = (typeof DIGITAL_SOURCE_TYPE)[keyof typeof DIGITAL_SOURCE_TYPE];

export type Provenance = { model: string | null; provider: string | null; sourceType?: DigitalSourceType };

export type MarkOutcome = { bytes: Buffer; marked: boolean };

type Claim = { sourceTypeIri: string; system: string | null; statement: string };

type Marker = (bytes: Buffer, claim: Claim) => Promise<Buffer | null>;

const GENERATOR = 'feega';
const IPTC_DIGITAL_SOURCE_TYPE = 'http://cv.iptc.org/newscodes/digitalsourcetype/';
const XMP_NS = 'http://ns.adobe.com/xap/1.0/';
const PNG_XMP_KEYWORD = 'XML:com.adobe.xmp';
const PNG_SIGNATURE_BYTES = 8;
const PNG_CHUNK_OVERHEAD = 12;
const JPEG_SEGMENT_MAX = 0xffff;
const JPEG_APP1 = 0xffe1;
const RIFF_HEADER_BYTES = 12;
const WEBP_VP8X_FLAGS_OFFSET = 20;
const WEBP_XMP_FLAG = 0x04;
const WEBP_ALPHA_FLAG = 0x10;
const MARK_ATTEMPTS = 2;
const FFMPEG_TIMEOUT_MS = 60_000;
const XML_ENTITY: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' };

const run = promisify(execFile);

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (c) => XML_ENTITY[c]);
}

function claimOf(provenance: Provenance): Claim {
  const sourceTypeIri = IPTC_DIGITAL_SOURCE_TYPE + (provenance.sourceType ?? DIGITAL_SOURCE_TYPE.synthetic);
  const named = [provenance.provider, provenance.model].filter((part): part is string => Boolean(part?.trim()));
  const system = named.length ? named.join('/') : null;
  const statement = [`AI-generated with ${GENERATOR}`, sourceTypeIri, system].filter(Boolean).join(' · ');
  return { sourceTypeIri, system, statement };
}

export function syntheticXmp(sourceType: DigitalSourceType, provenance: Omit<Provenance, 'sourceType'> = { model: null, provider: null }): string {
  return xmpOf(claimOf({ ...provenance, sourceType }));
}

function xmpOf(claim: Claim): string {
  const system = claim.system ? `<Iptc4xmpExt:AISystemUsed>${escapeXml(claim.system)}</Iptc4xmpExt:AISystemUsed>` : '';
  return (
    `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">` +
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
    `<rdf:Description rdf:about=""` +
    ` xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"` +
    ` xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"` +
    ` xmlns:xmp="${XMP_NS}">` +
    `<Iptc4xmpExt:DigitalSourceType>${claim.sourceTypeIri}</Iptc4xmpExt:DigitalSourceType>` +
    system +
    `<photoshop:Credit>AI-generated with ${GENERATOR}</photoshop:Credit>` +
    `<xmp:CreatorTool>${GENERATOR}</xmp:CreatorTool>` +
    `</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`
  );
}

function isPng(buf: Buffer): boolean {
  return buf.length > PNG_SIGNATURE_BYTES && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a;
}

function isJpeg(buf: Buffer): boolean {
  return buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8;
}

function isRiff(buf: Buffer, form: string): boolean {
  return buf.length > RIFF_HEADER_BYTES && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === form;
}

function isIsoBmff(buf: Buffer): boolean {
  return buf.length > 12 && buf.toString('latin1', 4, 8) === 'ftyp';
}

function isEbml(buf: Buffer): boolean {
  return buf.length > 4 && buf.readUInt32BE(0) === 0x1a45dfa3;
}

function isMp3(buf: Buffer): boolean {
  return buf.length > 3 && (buf.toString('latin1', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0));
}

function pngITXtChunk(keyword: string, text: string): Buffer {
  const noLanguageNoTranslation = Buffer.from([0, 0, 0, 0, 0]);
  const data = Buffer.concat([Buffer.from(keyword, 'latin1'), noLanguageNoTranslation, Buffer.from(text, 'utf8')]);
  const type = Buffer.from('iTXt', 'latin1');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])) >>> 0, 0);
  return Buffer.concat([len, type, data, crc]);
}

function pngWithXmp(buf: Buffer, xmp: string): Buffer | null {
  if (!isPng(buf)) {
    return null;
  }

  let off = PNG_SIGNATURE_BYTES;
  while (off + PNG_CHUNK_OVERHEAD <= buf.length) {
    const len = buf.readUInt32BE(off);
    if (buf.toString('latin1', off + 4, off + 8) === 'IDAT') {
      return Buffer.concat([buf.subarray(0, off), pngITXtChunk(PNG_XMP_KEYWORD, xmp), buf.subarray(off)]);
    }
    const next = off + PNG_CHUNK_OVERHEAD + len;
    if (next <= off || next > buf.length) {
      return null;
    }
    off = next;
  }
  return null;
}

function jpegWithXmp(buf: Buffer, xmp: string): Buffer | null {
  if (!isJpeg(buf)) {
    return null;
  }

  const payload = Buffer.concat([Buffer.from(`${XMP_NS}\0`, 'latin1'), Buffer.from(xmp, 'utf8')]);
  if (payload.length + 2 > JPEG_SEGMENT_MAX) {
    return null;
  }

  const header = Buffer.alloc(4);
  header.writeUInt16BE(JPEG_APP1, 0);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([buf.subarray(0, 2), header, payload, buf.subarray(2)]);
}

function riffChunk(type: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write(type, 0, 'latin1');
  header.writeUInt32LE(data.length, 4);
  const pad = data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0);
  return Buffer.concat([header, data, pad]);
}

async function webpWithVp8x(buf: Buffer): Promise<Buffer | null> {
  if (buf.toString('latin1', 12, 16) === 'VP8X') {
    const flagged = Buffer.from(buf);
    flagged[WEBP_VP8X_FLAGS_OFFSET] |= WEBP_XMP_FLAG;
    return flagged;
  }

  const meta = await sharp(buf).metadata();
  if (!meta.width || !meta.height) {
    return null;
  }

  const vp8x = Buffer.alloc(10);
  vp8x[0] = WEBP_XMP_FLAG | (meta.hasAlpha ? WEBP_ALPHA_FLAG : 0);
  vp8x.writeUIntLE(meta.width - 1, 4, 3);
  vp8x.writeUIntLE(meta.height - 1, 7, 3);
  return Buffer.concat([buf.subarray(0, RIFF_HEADER_BYTES), riffChunk('VP8X', vp8x), buf.subarray(RIFF_HEADER_BYTES)]);
}

async function webpWithXmp(buf: Buffer, xmp: string): Promise<Buffer | null> {
  if (!isRiff(buf, 'WEBP')) {
    return null;
  }

  const body = await webpWithVp8x(buf);
  if (!body) {
    return null;
  }

  const out = Buffer.concat([body, riffChunk('XMP ', Buffer.from(xmp, 'utf8'))]);
  out.writeUInt32LE(out.length - 8, 4);
  return out;
}

function imageMarker(mime: string, embed: (buf: Buffer, xmp: string) => Buffer | null | Promise<Buffer | null>): Marker {
  return async (bytes, claim) => {
    const tagged = await embed(bytes, xmpOf(claim));
    return tagged && signC2pa(tagged, mime, claim.sourceTypeIri);
  };
}

type Container = { extension: string; recognises: (buf: Buffer) => boolean; muxerArgs: string[] };

const CONTAINER = {
  mp4: { extension: 'mp4', recognises: isIsoBmff, muxerArgs: ['-movflags', 'use_metadata_tags+faststart'] },
  mov: { extension: 'mov', recognises: isIsoBmff, muxerArgs: ['-movflags', 'use_metadata_tags'] },
  webm: { extension: 'webm', recognises: isEbml, muxerArgs: [] },
  mp3: { extension: 'mp3', recognises: isMp3, muxerArgs: ['-id3v2_version', '3'] },
  wav: { extension: 'wav', recognises: (buf: Buffer) => isRiff(buf, 'WAVE'), muxerArgs: [] }
} satisfies Record<string, Container>;

const GLB_MAGIC = 'glTF';
const GLB_HEADER_BYTES = 12;
const GLB_CHUNK_HEADER_BYTES = 8;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_PADDING = 0x20;
const GLTF_XMP_EXTENSION = 'KHR_xmp_json_ld';
const XMP_JSON_LD_CONTEXT = {
  Iptc4xmpExt: 'http://iptc.org/std/Iptc4xmpExt/2008-02-29/',
  photoshop: 'http://ns.adobe.com/photoshop/1.0/',
  xmp: XMP_NS
};

type GltfJson = Record<string, any>;

function isGlb(buf: Buffer): boolean {
  return (
    buf.length > GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES &&
    buf.toString('ascii', 0, 4) === GLB_MAGIC &&
    buf.readUInt32LE(GLB_HEADER_BYTES + 4) === GLB_JSON_CHUNK
  );
}

export function readGlbJson(buf: Buffer): GltfJson {
  const length = buf.readUInt32LE(GLB_HEADER_BYTES);
  const start = GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES;
  return JSON.parse(buf.toString('utf8', start, start + length));
}

function xmpPacketOf(claim: Claim): Record<string, unknown> {
  return {
    '@context': XMP_JSON_LD_CONTEXT,
    'Iptc4xmpExt:DigitalSourceType': claim.sourceTypeIri,
    ...(claim.system ? { 'Iptc4xmpExt:AISystemUsed': claim.system } : {}),
    'photoshop:Credit': `AI-generated with ${GENERATOR}`,
    'xmp:CreatorTool': GENERATOR
  };
}

function withXmpPacket(json: GltfJson, claim: Claim): GltfJson {
  const packets = [...(json.extensions?.[GLTF_XMP_EXTENSION]?.packets ?? []), xmpPacketOf(claim)];
  return {
    ...json,
    extensionsUsed: [...new Set([...(json.extensionsUsed ?? []), GLTF_XMP_EXTENSION])],
    extensions: { ...json.extensions, [GLTF_XMP_EXTENSION]: { packets } },
    asset: { ...json.asset, extensions: { ...json.asset?.extensions, [GLTF_XMP_EXTENSION]: { packet: packets.length - 1 } } }
  };
}

function glbWithXmp(buf: Buffer, claim: Claim): Buffer | null {
  if (!isGlb(buf)) {
    return null;
  }

  const oldLength = buf.readUInt32LE(GLB_HEADER_BYTES);
  const rest = buf.subarray(GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES + oldLength);
  const raw = Buffer.from(JSON.stringify(withXmpPacket(readGlbJson(buf), claim)), 'utf8');
  const json = Buffer.concat([raw, Buffer.alloc((4 - (raw.length % 4)) % 4, GLB_PADDING)]);

  const header = Buffer.alloc(GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES);
  header.write(GLB_MAGIC, 0, 'ascii');
  header.writeUInt32LE(buf.readUInt32LE(4), 4);
  header.writeUInt32LE(header.length + json.length + rest.length, 8);
  header.writeUInt32LE(json.length, GLB_HEADER_BYTES);
  header.writeUInt32LE(GLB_JSON_CHUNK, GLB_HEADER_BYTES + 4);
  return Buffer.concat([header, json, rest]);
}

function containerTags(claim: Claim): string[] {
  const tags = { DigitalSourceType: claim.sourceTypeIri, AISystemUsed: claim.system, comment: claim.statement };
  return Object.entries(tags).flatMap(([key, value]) => (value ? ['-metadata', `${key}=${value}`] : []));
}

function containerMarker(container: Container): Marker {
  return async (bytes, claim) => {
    if (!container.recognises(bytes)) {
      return null;
    }

    const ffmpeg = await ensureFfmpegPath();
    if (!ffmpeg) {
      return null;
    }

    const dir = await mkdtemp(join(tmpdir(), 'cc-'));
    try {
      const src = join(dir, `in.${container.extension}`);
      const out = join(dir, `out.${container.extension}`);
      await writeFile(src, bytes);
      await run(
        ffmpeg,
        ['-y', '-loglevel', 'error', '-i', src, '-map', '0', '-c', 'copy', ...container.muxerArgs, ...containerTags(claim), out],
        { timeout: FFMPEG_TIMEOUT_MS }
      );
      const marked = await readFile(out);
      return marked.length > bytes.length / 2 ? marked : null;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
}

export const MARKING_STRATEGY: Record<string, Marker> = {
  'image/png': imageMarker('image/png', pngWithXmp),
  'image/jpeg': imageMarker('image/jpeg', jpegWithXmp),
  'image/jpg': imageMarker('image/jpeg', jpegWithXmp),
  'image/webp': imageMarker('image/webp', webpWithXmp),
  'video/mp4': containerMarker(CONTAINER.mp4),
  'video/quicktime': containerMarker(CONTAINER.mov),
  'video/webm': containerMarker(CONTAINER.webm),
  'audio/mpeg': containerMarker(CONTAINER.mp3),
  'audio/mp3': containerMarker(CONTAINER.mp3),
  'audio/wav': containerMarker(CONTAINER.wav),
  'audio/wave': containerMarker(CONTAINER.wav),
  'audio/x-wav': containerMarker(CONTAINER.wav),
  'model/gltf-binary': async (bytes, claim) => glbWithXmp(bytes, claim)
};

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function markGenerated(bytes: Buffer, mime: string, provenance: Provenance): Promise<MarkOutcome> {
  const essence = mime.split(';')[0].trim().toLowerCase();
  const marker = MARKING_STRATEGY[essence];
  if (!marker) {
    console.warn(`[content-credentials] no marking strategy for ${essence}: stored unmarked`);
    return { bytes, marked: false };
  }

  const claim = claimOf(provenance);
  for (let attempt = 1; attempt <= MARK_ATTEMPTS; attempt++) {
    try {
      const marked = await marker(bytes, claim);
      if (marked) {
        return { bytes: marked, marked: true };
      }
    } catch (error) {
      console.warn(`[content-credentials] ${essence} marking attempt ${attempt} failed: ${reason(error)}`);
    }
  }

  console.warn(`[content-credentials] ${essence} stored unmarked: bytes not recognised or marking failed`);
  return { bytes, marked: false };
}

export async function signC2pa(bytes: Buffer, mimeType: string, sourceTypeIri: string): Promise<Buffer> {
  const cert = env.C2PA_CERT?.trim();
  const key = env.C2PA_KEY?.trim();
  if (env.C2PA_SIGNING !== 'on' && !(cert && key)) {
    return bytes;
  }

  try {
    const { createC2pa, createTestSigner, ManifestBuilder, SigningAlgorithm } = await import(/* @vite-ignore */ 'c2pa-node');
    const signer = cert && key
      ? { type: 'local' as const, certificate: Buffer.from(cert), privateKey: Buffer.from(key), algorithm: SigningAlgorithm.ES256 }
      : await createTestSigner();
    const manifest = new ManifestBuilder({
      claim_generator: GENERATOR,
      format: mimeType,
      assertions: [{ label: 'c2pa.actions', data: { actions: [{ action: 'c2pa.created', digitalSourceType: sourceTypeIri }] } }]
    });
    const signed = await createC2pa({ signer }).sign({ asset: { buffer: bytes, mimeType }, manifest });
    const out = signed.signedAsset?.buffer;
    return out && out.length > bytes.length / 2 ? Buffer.from(out) : bytes;
  } catch (error) {
    console.warn(`[content-credentials] c2pa signing skipped: ${reason(error)}`);
    return bytes;
  }
}
