import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Db } from '$lib/server/db/client';
import { ensureFfmpegPath } from '$lib/server/ffmpeg-bin';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';

const run = promisify(execFile);

const PROXY_MIN_SHORT_SIDE = 1440;
const PROXY_LONG_EDGE = 960;
const PROXY_KEYFRAME_FRAMES = 15;
const PROXY_CRF = 28;
const PROXY_SUFFIX = '.proxy.mp4';
const TRANSCODE_TIMEOUT_MS = 10 * 60_000;
const MAX_BUFFER = 16 * 1024 * 1024;
const VIDEO_STREAM_SIZE = /Video:.*?\b(\d{2,5})x(\d{2,5})\b/;

export type Size = { width: number; height: number };

export const wantsProxy = ({ width, height }: Size): boolean => Math.min(width, height) >= PROXY_MIN_SHORT_SIDE;

export const proxyPathOf = (path: string): string => `${path}${PROXY_SUFFIX}`;

export function parseSize(log: string): Size | null {
  const found = VIDEO_STREAM_SIZE.exec(log);
  return found ? { width: Number(found[1]), height: Number(found[2]) } : null;
}

export function proxyArgs(input: string, output: string): string[] {
  const fit = `scale='if(gt(iw,ih),${PROXY_LONG_EDGE},-2)':'if(gt(iw,ih),-2,${PROXY_LONG_EDGE})'`;
  return ['-y', '-i', input, '-vf', fit, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(PROXY_CRF), '-g', String(PROXY_KEYFRAME_FRAMES), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', output];
}

async function probeSize(ffmpeg: string, file: string): Promise<Size | null> {
  const log = await run(ffmpeg, ['-hide_banner', '-i', file], { maxBuffer: MAX_BUFFER }).then(
    ({ stderr }) => stderr,
    (failed: { stderr?: string }) => failed.stderr ?? ''
  );
  return parseSize(log);
}

export type ProxyTarget = { orgId: string; assetId: string; path: string };

export async function createVideoProxy(db: Db, target: ProxyTarget): Promise<string | null> {
  const ffmpeg = await ensureFfmpegPath();
  if (!ffmpeg) {
    return null;
  }

  const bucket = db.storage.from(CANVAS_ASSET_BUCKET);
  const original = await bucket.download(target.path);
  if (original.error || !original.data) {
    return null;
  }

  const dir = await mkdtemp(join(tmpdir(), 'video-proxy-'));
  try {
    const input = join(dir, 'in');
    const output = join(dir, 'out.mp4');
    await writeFile(input, Buffer.from(await original.data.arrayBuffer()));

    const size = await probeSize(ffmpeg, input);
    if (!size || !wantsProxy(size)) {
      return null;
    }

    await run(ffmpeg, proxyArgs(input, output), { timeout: TRANSCODE_TIMEOUT_MS, maxBuffer: MAX_BUFFER });

    const proxyPath = proxyPathOf(target.path);
    const stored = await bucket.upload(proxyPath, await readFile(output), { contentType: 'video/mp4', upsert: true });
    if (stored.error) {
      return null;
    }

    const { error } = await db.from('assets').update({ proxy_url: proxyPath, width: size.width, height: size.height }).eq('org_id', target.orgId).eq('id', target.assetId);
    return error ? null : proxyPath;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
