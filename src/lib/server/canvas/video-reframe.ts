import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Db } from '$lib/server/db/client';
import { createConnection, createNode, findNode } from '$lib/server/repos/canvas';
import type { Actor } from '$lib/server/repos/actor';
import { findAsset, insertAsset, type Asset } from '$lib/server/repos/assets';
import { ensureFfmpegPath } from '$lib/server/ffmpeg-bin';
import { signMediaPaths } from '$lib/server/canvas/sign-media';
import { cropRect, ratioOf, type Focus } from '$lib/reframe';

const COLUMN_GAP = 80;
const DEFAULT_NODE_WIDTH = 320;
const MP4 = 'video/mp4';
const GENERATED_MEDIA_BUCKET = 'brand-knowledge';
const FFMPEG_BUFFER_BYTES = 32 * 1024 * 1024;
const VIDEO_SIZE = /Video:.*?(\d{2,5})x(\d{2,5})/;

type VideoRead = { bytes: Buffer; durationS: number | null };

type Mp4Scope = { orgId: string; projectId: string; userId: string; nodeId: string; bytes: Buffer; durationS: number | null };

export async function cropVideo(mp4: Buffer, ratio: number, focus?: Focus): Promise<Buffer | null> {
  const ffmpeg = await ensureFfmpegPath();
  if (!ffmpeg) {
    return null;
  }

  const dir = mkdtempSync(join(tmpdir(), 'reframe-'));
  try {
    const input = join(dir, 'in.mp4');
    const output = join(dir, 'out.mp4');
    writeFileSync(input, mp4);

    const probe = spawnSync(ffmpeg, ['-hide_banner', '-i', input], { encoding: 'utf8' }).stderr ?? '';
    const found = VIDEO_SIZE.exec(probe);
    if (!found) {
      return null;
    }

    const { x, y, width, height } = cropRect({ width: Number(found[1]), height: Number(found[2]) }, ratio, focus);
    const run = spawnSync(ffmpeg, ['-y', '-i', input, '-vf', `crop=${width}:${height}:${x}:${y}`, '-c:a', 'copy', '-pix_fmt', 'yuv420p', output], { maxBuffer: FFMPEG_BUFFER_BYTES });
    return run.status === 0 ? readFileSync(output) : null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function readVideo(db: Db, scope: { orgId: string; assetId: string }): Promise<VideoRead | null> {
  const asset = await findAsset(db, scope);
  const [url] = asset?.url ? await signMediaPaths(db, [asset.url]) : [];
  if (!asset || !url) {
    return null;
  }

  const response = await fetch(url);
  return response.ok ? { bytes: Buffer.from(await response.arrayBuffer()), durationS: asset.durationS } : null;
}

export async function storeMp4(db: Db, scope: Mp4Scope): Promise<Asset> {
  const path = `${scope.userId}/media/edits/${crypto.randomUUID()}.mp4`;
  const { error } = await db.storage.from(GENERATED_MEDIA_BUCKET).upload(path, new Blob([new Uint8Array(scope.bytes)], { type: MP4 }), { contentType: MP4, upsert: false });
  if (error) {
    throw new Error(`store_failed: ${error.message}`);
  }

  return insertAsset(db, {
    orgId: scope.orgId,
    projectId: scope.projectId,
    type: 'video',
    source: 'generated',
    url: path,
    mimeType: MP4,
    bytes: scope.bytes.byteLength,
    durationS: scope.durationS,
    sourceNodeId: scope.nodeId
  });
}

export type VideoReframeDeps = {
  findNode: typeof findNode;
  createNode: typeof createNode;
  createConnection: typeof createConnection;
  readVideo: typeof readVideo;
  cropVideo: typeof cropVideo;
  storeMp4: typeof storeMp4;
};

export const VIDEO_REFRAME_DEPS: VideoReframeDeps = { findNode, createNode, createConnection, readVideo, cropVideo, storeMp4 };

type VideoReframeInput = {
  orgId: string;
  projectId: string;
  userId: string;
  sourceNodeId: string;
  aspect: string;
  focus?: Focus;
  actor?: Actor;
};

export type VideoReframeStart = { ok: true; canvasId: string; nodeId: string } | { ok: false; error: string };

function refusalOf(source: Awaited<ReturnType<typeof findNode>>): string | null {
  if (!source) {
    return 'node_not_found';
  }
  if (source.type !== 'video') {
    return 'source_not_video';
  }
  return source.data.refId ? null : 'source_empty';
}

export async function startVideoReframe(db: Db, deps: VideoReframeDeps, input: VideoReframeInput): Promise<VideoReframeStart> {
  const source = await deps.findNode(db, { orgId: input.orgId, nodeId: input.sourceNodeId });
  const refusal = refusalOf(source);
  if (refusal || !source) {
    return { ok: false, error: refusal ?? 'node_not_found' };
  }

  const video = await deps.readVideo(db, { orgId: input.orgId, assetId: String(source.data.refId) });
  if (!video) {
    return { ok: false, error: 'source_unreadable' };
  }

  const cropped = await deps.cropVideo(video.bytes, ratioOf(input.aspect), input.focus);
  if (!cropped) {
    return { ok: false, error: 'reframe_failed' };
  }

  const actor = input.actor ?? { kind: 'user' as const, id: input.userId };
  const asset = await deps.storeMp4(db, { orgId: input.orgId, projectId: input.projectId, userId: input.userId, nodeId: source.id, bytes: cropped, durationS: video.durationS });
  const node = await deps.createNode(db, {
    orgId: input.orgId,
    projectId: input.projectId,
    canvasId: source.canvasId,
    type: 'video',
    x: source.position.x + (source.size.width ?? DEFAULT_NODE_WIDTH) + COLUMN_GAP,
    y: source.position.y,
    displayName: `Reframe ${input.aspect}`,
    data: { refId: asset.id },
    actor
  });
  await deps.createConnection(db, { orgId: input.orgId, canvasId: source.canvasId, sourceNodeId: source.id, targetNodeId: node.id, actor });

  return { ok: true, canvasId: source.canvasId, nodeId: node.id };
}
