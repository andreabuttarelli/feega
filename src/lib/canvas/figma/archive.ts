import { inflateSync } from 'fflate';
import { decompress } from 'fzstd';
import { compileSchema, decodeBinarySchema } from 'kiwi-schema';

export type Guid = { sessionID: number; localID: number };
export type Vec = { x: number; y: number };
export type Matrix = { m00: number; m01: number; m02: number; m10: number; m11: number; m12: number };
export type Rgba = { r: number; g: number; b: number; a: number };
export type ColorStop = { color: Rgba; position: number };

export type Paint = {
  type: string;
  color?: Rgba;
  opacity?: number;
  visible?: boolean;
  stops?: ColorStop[];
  transform?: Matrix;
  image?: { hash?: Uint8Array; name?: string };
};

export type Effect = { type: string; color?: Rgba; offset?: Vec; radius?: number; spread?: number; visible?: boolean };

export type FigmaRawNode = {
  guid: Guid;
  type?: string;
  name?: string;
  visible?: boolean;
  opacity?: number;
  size?: Vec;
  transform?: Matrix;
  parentIndex?: { guid: Guid; position: string };
  fillPaints?: Paint[];
  strokePaints?: Paint[];
  strokeWeight?: number;
  strokeAlign?: string;
  effects?: Effect[];
  cornerRadius?: number;
  rectangleTopLeftCornerRadius?: number;
  rectangleTopRightCornerRadius?: number;
  rectangleBottomRightCornerRadius?: number;
  rectangleBottomLeftCornerRadius?: number;
  rectangleCornerRadiiIndependent?: boolean;
  frameMaskDisabled?: boolean;
  resizeToFit?: boolean;
  stackMode?: string;
  stackSpacing?: number;
  stackHorizontalPadding?: number;
  stackVerticalPadding?: number;
  stackPaddingRight?: number;
  stackPaddingBottom?: number;
  fillGeometry?: { commandsBlob?: number }[];
  strokeGeometry?: { commandsBlob?: number }[];
  internalOnly?: boolean;
  vectorData?: { vectorNetworkBlob?: number; normalizedSize?: Vec };
  fontName?: { family: string; style: string };
  fontSize?: number;
  lineHeight?: { value: number; units: string };
  letterSpacing?: { value: number; units: string };
  textAlignHorizontal?: string;
  textData?: { characters: string; styleOverrideTable?: FigmaRawNode[]; characterStyleIDs?: number[] };
  styleID?: number;
  symbolData?: { symbolID?: Guid };
};

export type FigmaMeta = { fileKey?: string; pasteID?: number; dataType?: string };

export type FigmaMessage = { meta: FigmaMeta; nodes: FigmaRawNode[]; blobs: Uint8Array[] };

const HEADER = 'fig-kiwi';
const HEADER_BYTES = HEADER.length + 4;
const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];
const FIGMA = /\(figma\)([A-Za-z0-9+/=]+)\(\/figma\)/;
const FIGMETA = /\(figmeta\)([A-Za-z0-9+/=]+)\(\/figmeta\)/;

const bytesOf = (code: string) => Uint8Array.from(atob(code), (c) => c.charCodeAt(0));

const isZstd = (chunk: Uint8Array) => ZSTD_MAGIC.every((b, i) => chunk[i] === b);

const unpacked = (chunk: Uint8Array) => (isZstd(chunk) ? decompress(chunk) : inflateSync(chunk));

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

function metaOf(html: string): FigmaMeta {
  const code = html.match(FIGMETA)?.[1];
  if (!code) {
    return {};
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytesOf(code))) as FigmaMeta;
  } catch {
    return {};
  }
}

export function figmaMessage(html: string): FigmaMessage | null {
  const code = html.match(FIGMA)?.[1];
  if (!code) {
    return null;
  }
  try {
    const archive = bytesOf(code);
    if (new TextDecoder().decode(archive.subarray(0, HEADER.length)) !== HEADER) {
      return null;
    }
    const [schema, data] = chunksOf(archive);
    const decoded = compileSchema(decodeBinarySchema(unpacked(schema))).decodeMessage(unpacked(data)) as { nodeChanges?: FigmaRawNode[]; blobs?: { bytes: Uint8Array }[] };
    return { meta: metaOf(html), nodes: decoded.nodeChanges ?? [], blobs: (decoded.blobs ?? []).map((b) => b.bytes) };
  } catch {
    return null;
  }
}
