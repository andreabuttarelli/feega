import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { audioPlan } from '../audio-plan';
import type { Quality } from '../export-formats';
import { frameTimes, samplesPerFrame, type Size } from '../export-plan';
import { encodeMp4, mixAudio } from './encode';
import { docCuts, joltMeter, type JoltAt } from '../smoothness';
import { orFallback } from './fallback';
import { keepAwake, type Page, type WakeLockHost } from './stay-awake';

export type FrameSource = (times: number[], size: Size, onFrame: (bitmap: ImageBitmap, index: number) => Promise<void>, signal: AbortSignal) => Promise<void>;

export type SecondsRange = { from: number; to: number };

export enum BrowserStage {
  Mixing = 'mixing',
  Rendering = 'rendering'
}

export type BrowserJob = {
  doc: MotionDoc;
  assetUrls: Record<string, string>;
  size: Size;
  quality: Quality;
  withAudio: boolean;
  range?: SecondsRange | null;
  frames: FrameSource;
  fallback?: FrameSource | null;
  onFallback?: (error: unknown) => void;
  signal: AbortSignal;
  onStage: (stage: BrowserStage) => void;
  onFrame: (done: number) => void;
  onJolts?: (jolts: JoltAt[]) => void;
  host?: { nav: WakeLockHost; page: Page };
};

export async function renderInBrowser(job: BrowserJob): Promise<Blob> {
  const host = job.host ?? { nav: navigator as WakeLockHost, page: document };
  const release = await keepAwake(host.nav, host.page);
  try {
    job.onStage(BrowserStage.Mixing);
    const span = framesOf(job.doc, job.range);
    const sounds = job.withAudio && !job.range ? audioPlan(job.doc, job.assetUrls) : [];
    const audio = sounds.length ? await mixAudio(sounds, job.doc.durationInFrames / job.doc.fps) : null;

    job.onStage(BrowserStage.Rendering);
    const samples = samplesPerFrame(job.doc);
    const times = frameTimes(job.doc).slice(span.from * samples, span.to * samples);
    const meter = job.onJolts ? joltMeter() : undefined;
    const encode = (frames: FrameSource) => () => encodeMp4({
      size: job.size,
      fps: job.doc.fps,
      quality: job.quality,
      frames: span.to - span.from,
      samples,
      audio,
      signal: job.signal,
      render: (onFrame) => frames(times, job.size, onFrame, job.signal),
      onFrame: job.onFrame,
      meter
    });
    const blob = await orFallback(encode(job.frames), job.fallback ? encode(job.fallback) : null, job.signal, job.onFallback);
    job.onJolts?.(meter ? meter.jolts({ cuts: docCuts(job.doc) }) : []);
    return blob;
  } finally {
    release();
  }
}

export function framesOf(doc: Pick<MotionDoc, 'fps' | 'durationInFrames'>, range?: SecondsRange | null): { from: number; to: number } {
  if (!range) {
    return { from: 0, to: doc.durationInFrames };
  }
  const from = Math.min(Math.max(0, Math.round(range.from * doc.fps)), doc.durationInFrames - 1);
  return { from, to: Math.min(doc.durationInFrames, Math.max(from + 1, Math.round(range.to * doc.fps))) };
}
