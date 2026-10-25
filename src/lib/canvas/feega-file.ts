import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { z } from 'zod';

export const FEEGA_EXTENSION = '.feega';
export const FEEGA_MIME = 'application/vnd.feega+zip';
export const FEEGA_VERSION = 1;
export const FEEGA_MAX_BYTES = 200 * 1024 * 1024;

const MANIFEST_ENTRY = 'manifest.json';
const CANVAS_ENTRY = 'canvas.json';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export enum FeegaRefusal {
  NotFeega = 'not_feega',
  NewerVersion = 'newer_version',
  Damaged = 'damaged',
  TooLarge = 'too_large'
}

export const FEEGA_REFUSAL_MESSAGE: Record<FeegaRefusal, string> = {
  [FeegaRefusal.NotFeega]: 'This is not a .feega file.',
  [FeegaRefusal.NewerVersion]: 'This file was saved by a newer feega. Update this instance and try again.',
  [FeegaRefusal.Damaged]: 'This .feega file is damaged: part of the canvas is missing or unreadable.',
  [FeegaRefusal.TooLarge]: 'This .feega file is larger than 200 MB.'
};

const manifestSchema = z.object({
  format: z.literal('feega'),
  version: z.number().int().positive(),
  exportedAt: z.string(),
  canvasName: z.string(),
  source: z.object({ projectId: z.string(), canvasId: z.string() })
});

const canvasSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      displayName: z.string().nullable(),
      position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
      size: z.object({ width: z.number().nullable(), height: z.number().nullable() }),
      data: z.record(z.string(), z.unknown())
    })
  ),
  connections: z.array(
    z.object({
      id: z.string(),
      sourceNodeId: z.string(),
      targetNodeId: z.string(),
      sourceHandle: z.string().nullable(),
      targetHandle: z.string().nullable(),
      mode: z.enum(['fixed', 'iterate'])
    })
  ),
  heads: z.record(z.string(), z.object({ version: z.number(), doc: z.unknown() })),
  assets: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      mimeType: z.string().nullable(),
      width: z.number().nullable(),
      height: z.number().nullable(),
      durationS: z.number().nullable(),
      content: z.string().nullable(),
      url: z.string().nullable(),
      file: z.string().nullable()
    })
  )
});

export type FeegaManifest = z.infer<typeof manifestSchema>;
export type FeegaCanvas = z.infer<typeof canvasSchema>;
export type FeegaAsset = FeegaCanvas['assets'][number];
export type FeegaFile = { manifest: FeegaManifest; canvas: FeegaCanvas };
export type FeegaBlobs = Map<string, Uint8Array>;

export type Unpacked = { ok: true; file: FeegaFile; blobs: FeegaBlobs } | { ok: false; refusal: FeegaRefusal };

export function packFeega(file: FeegaFile, blobs: FeegaBlobs): Uint8Array {
  return zipSync({
    [MANIFEST_ENTRY]: strToU8(JSON.stringify(file.manifest)),
    [CANVAS_ENTRY]: strToU8(JSON.stringify(file.canvas)),
    ...Object.fromEntries(blobs)
  });
}

function entries(bytes: Uint8Array): Record<string, Uint8Array> | FeegaRefusal {
  let declared = 0;
  try {
    const unzipped = unzipSync(bytes, { filter: (f) => (declared += f.originalSize) <= FEEGA_MAX_BYTES });
    return declared > FEEGA_MAX_BYTES ? FeegaRefusal.TooLarge : unzipped;
  } catch {
    return FeegaRefusal.NotFeega;
  }
}

function json(bytes: Uint8Array | undefined): unknown {
  try {
    return bytes ? JSON.parse(strFromU8(bytes)) : undefined;
  } catch {
    return undefined;
  }
}

export function unpackFeega(bytes: Uint8Array): Unpacked {
  const files = entries(bytes);
  if (typeof files === 'string') {
    return { ok: false, refusal: files };
  }

  const manifest = manifestSchema.safeParse(json(files[MANIFEST_ENTRY]));
  if (!manifest.success) {
    return { ok: false, refusal: FeegaRefusal.NotFeega };
  }
  if (manifest.data.version > FEEGA_VERSION) {
    return { ok: false, refusal: FeegaRefusal.NewerVersion };
  }

  const canvas = canvasSchema.safeParse(json(files[CANVAS_ENTRY]));
  if (!canvas.success) {
    return { ok: false, refusal: FeegaRefusal.Damaged };
  }

  const listed = canvas.data.assets.flatMap((a) => (a.file ? [a.file] : []));
  if (listed.some((name) => !files[name])) {
    return { ok: false, refusal: FeegaRefusal.Damaged };
  }

  return { ok: true, file: { manifest: manifest.data, canvas: canvas.data }, blobs: new Map(listed.map((name) => [name, files[name]])) };
}

export function idsIn(value: unknown): string[] {
  return [...new Set((JSON.stringify(value).match(UUID) ?? []).map((id) => id.toLowerCase()))];
}

export function remapIds<T>(value: T, ids: ReadonlyMap<string, string>): T {
  return JSON.parse(JSON.stringify(value).replace(UUID, (id) => ids.get(id.toLowerCase()) ?? id)) as T;
}

export const isFeegaFile = (file: { name: string }) => file.name.toLowerCase().endsWith(FEEGA_EXTENSION);
