import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type VideoFacts = { width: number; height: number; fps: number; seconds: number; bytes: number };

type Probe = { streams: { codec_type: string; width?: number; height?: number; avg_frame_rate?: string }[]; format: { duration?: string; size?: string } };

const fraction = (rate: string | undefined): number => {
  const [n, d] = (rate ?? '0/1').split('/').map(Number);
  return d ? n / d : 0;
};

export async function probeVideo(file: string): Promise<VideoFacts> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]);
  const probe = JSON.parse(stdout) as Probe;
  const video = probe.streams.find((s) => s.codec_type === 'video');
  return {
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    fps: Math.round(fraction(video?.avg_frame_rate) * 100) / 100,
    seconds: Math.round(Number(probe.format.duration ?? 0) * 100) / 100,
    bytes: Number(probe.format.size ?? 0)
  };
}

export async function extractFrames(file: string, times: number[], seconds: number): Promise<string[]> {
  const dir = mkdtempSync(join(tmpdir(), 'external-agent-frames-'));
  const frames: string[] = [];
  for (const [i, wanted] of times.entries()) {
    const at = Math.min(wanted, Math.max(0, seconds - 0.1));
    const out = join(dir, `f${i}.jpg`);
    await run('ffmpeg', ['-v', 'error', '-ss', String(at), '-i', file, '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '3', out]);
    frames.push(readFileSync(out).toString('base64'));
  }
  return frames;
}
