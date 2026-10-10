import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SCENE_THRESHOLD = 0.3;
const PROBE = 160;
const SHEET_COLUMNS = 8;
const JUDGE_FRAMES = 8;
const AUDIO_RATE = 22050;
const BUFFER = 1 << 30;

const ffmpeg = (args: string[]) => spawnSync('ffmpeg', ['-v', 'info', '-hide_banner', ...args], { maxBuffer: BUFFER });

export function duration(video: string): number {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).toString().trim());
}

export function cuts(video: string): number[] {
  const out = ffmpeg(['-i', video, '-vf', `select='gt(scene,${SCENE_THRESHOLD})',showinfo`, '-an', '-f', 'null', '-']).stderr.toString();
  return [...out.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
}

export function grayFrames(video: string): Uint8Array[] {
  const raw = ffmpeg(['-i', video, '-vf', `fps=1,scale=${PROBE}:${PROBE},format=gray`, '-an', '-f', 'rawvideo', '-']).stdout;
  const size = PROBE * PROBE;
  return Array.from({ length: Math.floor(raw.length / size) }, (_, i) => new Uint8Array(raw.subarray(i * size, (i + 1) * size)));
}

export const PROBE_SIZE = PROBE;

export function contactSheet(video: string, seconds: number, file: string): void {
  const rows = Math.max(1, Math.ceil(seconds / SHEET_COLUMNS));
  ffmpeg(['-y', '-i', video, '-vf', `fps=1,scale=320:-2,tile=${SHEET_COLUMNS}x${rows}`, '-frames:v', '1', '-q:v', '4', file]);
}

export function judgeFrames(video: string, seconds: number, dir: string): string[] {
  mkdirSync(dir, { recursive: true });
  return Array.from({ length: JUDGE_FRAMES }, (_, i) => {
    const file = join(dir, `judge-${i}.jpg`);
    ffmpeg(['-y', '-ss', String((seconds * (i + 0.5)) / JUDGE_FRAMES), '-i', video, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '4', file]);
    return file;
  });
}

export function monoSamples(video: string): { samples: Float32Array; rate: number } | null {
  const raw = ffmpeg(['-i', video, '-vn', '-ac', '1', '-ar', String(AUDIO_RATE), '-f', 'f32le', '-']).stdout;
  if (!raw.length) {
    return null;
  }
  const copy = new Uint8Array(raw).buffer;
  return { samples: new Float32Array(copy, 0, Math.floor(raw.length / 4)), rate: AUDIO_RATE };
}
