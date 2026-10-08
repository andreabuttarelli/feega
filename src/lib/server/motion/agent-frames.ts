import type { Db } from '$lib/server/db/client';
import { AssetKind } from '$lib/motion/components';
import { blocking, docProblems, frameProblems } from '$lib/motion/direction';
import { savedMotion } from './agent-embed';
import { assetUrls, motionAssets, motionTokens } from './editor';
import { chromiumFrames, serverFramesOpen } from './chromium-frames';
import { drawFrames, MAX_FRAME_SIZE } from './server-frames';
import { MAX_FRAMES_PER_VIEW } from './frames';
import { frameStats } from './frame-stats';

export enum FramesFailure {
  NotFound = 'motion_node_not_found',
  Empty = 'nothing_to_draw',
  BadTimes = 'invalid_times',
  Limited = 'rate_limited',
  Closed = 'server_frames_unavailable'
}

export type FramesAnswer = { ok: true; body: Record<string, unknown> } | { ok: false; failure: FramesFailure; detail?: string };

export type FramesAsk = { times: number[]; size?: number };

const ORG_CALLS_PER_WINDOW = 10;
const WINDOW_MS = 60_000;
const recentCalls = new Map<string, number[]>();

export function resetFrameLimits() {
  recentCalls.clear();
}

function takeSlot(orgId: string, now = Date.now()): boolean {
  const recent = (recentCalls.get(orgId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= ORG_CALLS_PER_WINDOW) {
    recentCalls.set(orgId, recent);
    return false;
  }
  recentCalls.set(orgId, [...recent, now]);
  return true;
}

function timesProblem(times: readonly number[], seconds: number): string | null {
  if (times.length === 0 || times.length > MAX_FRAMES_PER_VIEW) {
    return `ask for 1 to ${MAX_FRAMES_PER_VIEW} times`;
  }
  const outside = times.find((t) => !Number.isFinite(t) || t < 0 || t > seconds);
  return outside === undefined ? null : `${outside}s is outside the video (0 to ${seconds}s)`;
}

export async function motionFrames(db: Db, scope: { orgId: string; nodeId: string }, ask: FramesAsk): Promise<FramesAnswer> {
  if (!serverFramesOpen()) {
    return { ok: false, failure: FramesFailure.Closed };
  }
  const saved = await savedMotion(db, scope);
  if (!saved) {
    return { ok: false, failure: FramesFailure.NotFound };
  }
  if (saved.version === 0) {
    return { ok: false, failure: FramesFailure.Empty };
  }

  const { doc } = saved;
  const problem = timesProblem(ask.times, doc.durationInFrames / doc.fps);
  if (problem) {
    return { ok: false, failure: FramesFailure.BadTimes, detail: problem };
  }
  if (!takeSlot(scope.orgId)) {
    return { ok: false, failure: FramesFailure.Limited, detail: `at most ${ORG_CALLS_PER_WINDOW} frame calls a minute per workspace` };
  }

  const assets = await motionAssets({ db, orgId: scope.orgId, projectId: saved.project.id, canvasId: saved.record.canvasId });
  const tokens = await motionTokens(db, { orgId: scope.orgId, brandId: saved.project.brandId });
  const frames = await drawFrames(chromiumFrames, { compose: { doc, tokens, assets: assetUrls(assets) }, times: ask.times, size: ask.size });

  const audioAssets = assets.filter((a) => a.kind === AssetKind.Audio).length;
  const gate = [...docProblems(doc, { audioAssets }), ...frameProblems(await frameStats(frames))];
  return {
    ok: true,
    body: {
      revision: saved.version,
      frames: frames.map((f) => ({ time: f.time, mime: 'image/jpeg', data: f.bytes.toString('base64') })),
      quality: gate.map((p) => p.detail),
      blocking: blocking(gate).map((p) => p.detail),
      max_size: MAX_FRAME_SIZE
    }
  };
}
