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

const CHECK_SIZE = { width: 192, height: 108 };
const FOREGROUND_DELTA = 96;
const SIZE_TOLERANCE = 1.33;
const CENTRE_TOLERANCE = 10;
const BACKGROUND_DELTA = 40;
const PERCENT = 100;

type Rgb = [number, number, number];

type Box = { left: number; top: number; width: number; height: number };

type Layout = { background: Rgb; box: Box | null };

export type PairCheck = { mismatches: string[] };

const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];

const hex = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

const percent = (v: number, of: number) => Math.round((v / of) * PERCENT);

async function layoutOf(picture: Buffer): Promise<Layout> {
  const { width, height } = CHECK_SIZE;
  const px = await sharp(picture).resize(width, height, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const at = (x: number, y: number): Rgb => {
    const i = (y * width + x) * 3;
    return [px[i], px[i + 1], px[i + 2]];
  };
  const all = Array.from({ length: width * height }, (_, i) => at(i % width, Math.floor(i / width)));
  const background: Rgb = [0, 1, 2].map((c) => median(all.map((p) => p[c]))) as Rgb;

  let [minX, minY, maxX, maxY] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = at(x, y);
      if (Math.max(...p.map((v, c) => Math.abs(v - background[c]))) <= FOREGROUND_DELTA) {
        continue;
      }
      [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
    }
  }
  const box = maxX < 0 ? null : { left: percent(minX, width), top: percent(minY, height), width: percent(maxX - minX + 1, width), height: percent(maxY - minY + 1, height) };
  return { background, box };
}

const offScale = (reference: number, ours: number) => ours * SIZE_TOLERANCE < reference || reference * SIZE_TOLERANCE < ours;

const centre = (b: Box) => [b.left + b.width / 2, b.top + b.height / 2];

function boxMismatches(reference: Box | null, ours: Box | null): string[] {
  if (!reference || !ours) {
    return reference === ours ? [] : [`content ${reference ? 'missing in yours' : 'in yours where the reference shows none'}`];
  }
  const found: string[] = [];
  if (offScale(reference.height, ours.height)) {
    found.push(`content height ${reference.height}% of the frame in the reference vs ${ours.height}% in yours`);
  }
  if (offScale(reference.width, ours.width)) {
    found.push(`content width ${reference.width}% vs ${ours.width}%`);
  }
  const [rc, oc] = [centre(reference), centre(ours)];
  if (Math.hypot(rc[0] - oc[0], rc[1] - oc[1]) > CENTRE_TOLERANCE) {
    found.push(`content centre at (${Math.round(rc[0])}%, ${Math.round(rc[1])}%) vs (${Math.round(oc[0])}%, ${Math.round(oc[1])}%)`);
  }
  return found;
}

export async function pairCheck(reference: Buffer, ours: Buffer): Promise<PairCheck> {
  const [r, o] = await Promise.all([layoutOf(reference), layoutOf(ours)]);
  const colour = Math.max(...r.background.map((v, c) => Math.abs(v - o.background[c]))) > BACKGROUND_DELTA ? [`background ${hex(r.background)} vs ${hex(o.background)}`] : [];
  return { mismatches: [...colour, ...boxMismatches(r.box, o.box)] };
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
