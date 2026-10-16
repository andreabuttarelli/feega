import sharp from 'sharp';
import { spawn } from 'node:child_process';
import type { VideoBreakdown } from '$lib/video-reference';

export const MAX_REFERENCE_FRAMES = 12;
export { CLOSE_TO_REFERENCE } from '$lib/motion/replica';
const PER_SCENE = 3;
const EDGE_S = 0.2;
const MODEL_WIDTH_PX = 768;
const COMPARE_SIZE = { width: 48, height: 27 };
const CHANNEL_MAX = 255;

export type KeyTime = { scene: number; time: number };
export type ReferenceFrame = KeyTime & { bytes: Buffer };
export type ScoredTime = KeyTime & { score: number };

const tenth = (s: number) => Math.round(s * 10) / 10;

function sceneTimes(start: number, end: number, count: number): number[] {
  const mid = tenth((start + end) / 2);
  if (count < PER_SCENE || end - start < 2 * EDGE_S) {
    return [mid];
  }
  return [tenth(start + EDGE_S), mid, tenth(end - EDGE_S)];
}

export const SCENE_FPS = 6;
export const SCENE_FRAMES_CAP = 24;

const hundredth = (s: number) => Math.round(s * 100) / 100;

export function denseTimes(scene: { start: number; end: number }): number[] {
  const length = scene.end - scene.start;
  const count = Math.min(SCENE_FRAMES_CAP, Math.max(1, Math.round(length * SCENE_FPS)));
  return Array.from({ length: count }, (_, i) => hundredth(scene.start + ((i + 0.5) * length) / count));
}

export function spreadTimes(times: readonly number[], count: number): number[] {
  if (times.length <= count) {
    return [...times];
  }
  return Array.from({ length: count }, (_, i) => times[Math.round((i * (times.length - 1)) / (count - 1))]);
}

export function keyTimes(b: Pick<VideoBreakdown, 'scenes'>): KeyTime[] {
  const count = Math.max(1, Math.min(PER_SCENE, Math.floor(MAX_REFERENCE_FRAMES / b.scenes.length)));
  return b.scenes.slice(0, MAX_REFERENCE_FRAMES).flatMap((s, i) => sceneTimes(s.start, s.end, count).map((time) => ({ scene: i + 1, time })));
}

export type GrabFrame = (time: number) => Promise<Buffer | null>;

export async function referenceFrames(grab: GrabFrame, times: readonly KeyTime[]): Promise<ReferenceFrame[]> {
  const grabbed = await Promise.all(times.map(async (t) => ({ ...t, bytes: await grab(t.time).catch(() => null) })));
  return grabbed.filter((f): f is ReferenceFrame => !!f.bytes?.length);
}

const tiny = (picture: Buffer) => sharp(picture).resize(COMPARE_SIZE.width, COMPARE_SIZE.height, { fit: 'fill' }).removeAlpha().raw().toBuffer();

export async function similarity(a: Buffer, b: Buffer): Promise<number> {
  const [x, y] = await Promise.all([tiny(a), tiny(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) {
    diff += Math.abs(x[i] - y[i]);
  }
  return Math.round((1 - diff / (x.length * CHANNEL_MAX)) * 100) / 100;
}

export function sceneScores(scored: readonly ScoredTime[]): { scene: number; score: number }[] {
  const byScene = new Map<number, number[]>();
  scored.forEach((s) => byScene.set(s.scene, [...(byScene.get(s.scene) ?? []), s.score]));
  return [...byScene].map(([scene, scores]) => ({ scene, score: Math.round((scores.reduce((sum, v) => sum + v, 0) / scores.length) * 100) / 100 }));
}

export const referencePicture = (f: ReferenceFrame) => ({ label: `Reference frame — scene ${f.scene} at ${f.time} s:`, bytes: f.bytes });

export type Comparison = { scenes: { scene: number; score: number }[]; times: ScoredTime[] };

export async function compareFrames(reference: readonly ReferenceFrame[], drawn: readonly { time: number; bytes: Buffer }[] | null): Promise<Comparison | null> {
  if (!drawn) {
    return null;
  }
  const byTime = new Map(drawn.filter((d) => d.bytes.length).map((d) => [d.time, d.bytes]));
  const scored = await Promise.all(reference.filter((r) => byTime.has(r.time)).map(async (r) => ({ scene: r.scene, time: r.time, score: await similarity(r.bytes, byTime.get(r.time)!) })));
  return { scenes: sceneScores(scored), times: scored };
}

export function ffmpegGrab(bin: string, url: string): GrabFrame {
  return (time) =>
    new Promise((resolve) => {
      const args = ['-v', 'error', '-ss', String(time), '-i', url, '-frames:v', '1', '-vf', `scale=${MODEL_WIDTH_PX}:-2`, '-f', 'image2pipe', '-vcodec', 'mjpeg', '-'];
      const child = spawn(bin, args);
      const chunks: Buffer[] = [];
      child.stdout.on('data', (c: Buffer) => chunks.push(c));
      child.on('error', () => resolve(null));
      child.on('close', (code) => resolve(code === 0 && chunks.length ? Buffer.concat(chunks) : null));
    });
}
