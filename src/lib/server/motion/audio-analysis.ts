import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Db } from '$lib/server/db/client';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { ensureFfmpegPath } from '$lib/server/ffmpeg-bin';
import { FPS } from '$lib/motion/design';
import { ANALYSIS_VERSION, analyzeAudio, type AudioAnalysis } from '$lib/motion/audio-analysis';
import { AssetKind } from '$lib/motion/components';
import type { MotionAsset } from './editor';

export type AssetRef = { orgId: string; projectId: string; assetId: string; url: string };
export type Decoded = { samples: Float32Array; rate: number };
export type AnalysisDeps = {
  read: (path: string) => Promise<string | null>;
  write: (path: string, json: string) => Promise<void>;
  decode: (url: string) => Promise<Decoded>;
};

const DECODE_RATE = 22_050;
const MAX_DECODED_BYTES = 128 * 1024 * 1024;
const JSON_MIME = 'application/json';

const run = promisify(execFile);

export function analysisPath(ref: Pick<AssetRef, 'orgId' | 'projectId' | 'assetId'>): string {
  return `${ref.orgId}/${ref.projectId}/analysis/${ref.assetId}.v${ANALYSIS_VERSION}.json`;
}

function current(json: string | null): AudioAnalysis | null {
  if (!json) {
    return null;
  }
  const parsed = JSON.parse(json) as AudioAnalysis;
  return parsed.version === ANALYSIS_VERSION ? parsed : null;
}

export async function analysisFor(deps: AnalysisDeps, ref: AssetRef): Promise<AudioAnalysis | null> {
  const path = analysisPath(ref);
  const stored = current(await deps.read(path));
  if (stored) {
    return stored;
  }

  let decoded: Decoded;
  try {
    decoded = await deps.decode(ref.url);
  } catch {
    return null;
  }
  const analysis = analyzeAudio(decoded.samples, decoded.rate, FPS);
  await deps.write(path, JSON.stringify(analysis)).catch(() => {});
  return analysis;
}

export async function decodeMono(url: string): Promise<Decoded> {
  const ffmpeg = await ensureFfmpegPath();
  if (!ffmpeg) {
    throw new Error('no ffmpeg');
  }
  const { stdout } = await run(ffmpeg, ['-v', 'error', '-i', url, '-ac', '1', '-ar', String(DECODE_RATE), '-f', 'f32le', '-'], { encoding: 'buffer', maxBuffer: MAX_DECODED_BYTES });
  const bytes = Uint8Array.from(stdout);
  return { samples: new Float32Array(bytes.buffer, 0, Math.floor(bytes.byteLength / Float32Array.BYTES_PER_ELEMENT)), rate: DECODE_RATE };
}

export function storageAnalysis(db: Db): AnalysisDeps {
  const bucket = () => db.storage.from(CANVAS_ASSET_BUCKET);
  return {
    read: async (path) => {
      const { data } = await bucket().download(path);
      return data ? data.text() : null;
    },
    write: async (path, json) => {
      const { error } = await bucket().upload(path, new Blob([json], { type: JSON_MIME }), { contentType: JSON_MIME, upsert: false });
      if (error) {
        throw error;
      }
    },
    decode: decodeMono
  };
}

const ANALYSABLE: ReadonlySet<AssetKind> = new Set([AssetKind.Audio, AssetKind.Video]);

export async function analyzeSounds(deps: AnalysisDeps, scope: { orgId: string; projectId: string }, assets: MotionAsset[], ids: string[]): Promise<Record<string, AudioAnalysis>> {
  const wanted = assets.filter((a) => ids.includes(a.id) && ANALYSABLE.has(a.kind) && a.url);
  const done = await Promise.all(wanted.map(async (a) => [a.id, await analysisFor(deps, { ...scope, assetId: a.id, url: a.url as string })] as const));
  return Object.fromEntries(done.flatMap(([id, analysis]) => (analysis ? [[id, analysis]] : [])));
}
