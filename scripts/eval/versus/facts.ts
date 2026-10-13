import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { frameDiffs, motionJolts, Jolt } from '$lib/motion/smoothness';
import { grayFrames, PROBE_SIZE } from '../motion-quality/media';
import { edgeDensity, emptyShare } from '../motion-quality/score';

export const SMOOTH_FPS = 30;
const SMOOTH_PX = 64;
export const CUT_DIFF = 30;
export const FROZEN_DIFF = 0.15;
export const BLACK_LUMA = 16;
export const SEAM_RATIO_OK = 3;
const BUFFER = 1 << 30;

export type VideoFacts = {
  exists: boolean;
  width: number | null;
  height: number | null;
  fps: number | null;
  duration: number | null;
  emptyShare: number | null;
  blackShare: number | null;
  pops: number | null;
  stops: number | null;
  flickers: number | null;
  longestFreezeS: number | null;
  frozenShare: number | null;
  loopSeam: number | null;
};

export const MISSING: VideoFacts = { exists: false, width: null, height: null, fps: null, duration: null, emptyShare: null, blackShare: null, pops: null, stops: null, flickers: null, longestFreezeS: null, frozenShare: null, loopSeam: null };

type Stream = { codec_type?: string; width?: number; height?: number; avg_frame_rate?: string; r_frame_rate?: string };

export function parseProbe(json: string): Pick<VideoFacts, 'width' | 'height' | 'fps' | 'duration'> {
  const probe = JSON.parse(json) as { streams?: Stream[]; format?: { duration?: string } };
  const video = probe.streams?.find((s) => s.codec_type === 'video');
  const [num, den] = (video?.avg_frame_rate && video.avg_frame_rate !== '0/0' ? video.avg_frame_rate : (video?.r_frame_rate ?? '0/1')).split('/').map(Number);
  return { width: video?.width ?? null, height: video?.height ?? null, fps: den ? Math.round((num / den) * 100) / 100 : null, duration: probe.format?.duration ? Number(probe.format.duration) : null };
}

export function cutFrames(diffs: readonly number[], threshold = CUT_DIFF): number[] {
  return diffs.flatMap((d, i) => (d > threshold ? [i] : []));
}

export function freezes(diffs: readonly number[], fps: number, threshold = FROZEN_DIFF) {
  if (!diffs.length) {
    return { longestFreezeS: null, frozenShare: null };
  }
  let run = 0;
  let longest = 0;
  for (const d of diffs) {
    run = d < threshold ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { longestFreezeS: longest / fps, frozenShare: diffs.filter((d) => d < threshold).length / diffs.length };
}

export function joltCounts(diffs: readonly number[]) {
  const found = motionJolts(diffs, { cuts: cutFrames(diffs) });
  const count = (kind: Jolt) => found.filter((j) => j.kind === kind).length;
  return { pops: count(Jolt.Pop), stops: count(Jolt.Stop), flickers: count(Jolt.Flicker) };
}

const mean = (frame: ArrayLike<number>) => {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    sum += frame[i];
  }
  return sum / frame.length;
};

export function blackShare(frames: readonly ArrayLike<number>[], luma = BLACK_LUMA): number | null {
  return frames.length ? frames.filter((f) => mean(f) < luma).length / frames.length : null;
}

export function loopSeam(frames: readonly ArrayLike<number>[], diffs: readonly number[]): number | null {
  if (frames.length < 2 || !diffs.length) {
    return null;
  }
  const seam = frameDiffs([frames[frames.length - 1], frames[0]])[0];
  const typical = [...diffs].sort((a, b) => a - b)[diffs.length >> 1];
  return seam / Math.max(typical, FROZEN_DIFF);
}

function smoothFrames(video: string): Uint8Array[] {
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', `fps=${SMOOTH_FPS},scale=${SMOOTH_PX}:${SMOOTH_PX},format=gray`, '-an', '-f', 'rawvideo', '-'], { maxBuffer: BUFFER }).stdout;
  const size = SMOOTH_PX * SMOOTH_PX;
  return Array.from({ length: Math.floor(raw.length / size) }, (_, i) => new Uint8Array(raw.subarray(i * size, (i + 1) * size)));
}

export function videoFacts(video: string): VideoFacts {
  if (!existsSync(video)) {
    return MISSING;
  }
  const probe = parseProbe(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', video]).toString());
  const frames = smoothFrames(video);
  const diffs = frameDiffs(frames);
  const stills = grayFrames(video);
  return {
    exists: true,
    ...probe,
    emptyShare: emptyShare(stills.map((g) => edgeDensity(g, PROBE_SIZE, PROBE_SIZE))),
    blackShare: blackShare(stills),
    ...joltCounts(diffs),
    ...freezes(diffs, SMOOTH_FPS),
    loopSeam: loopSeam(frames, diffs)
  };
}
