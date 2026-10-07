import type { MotionDoc } from '../doc';
import { audioPlan } from '../audio-plan';
import { frameTimes, samplesPerFrame, type Size } from '../export-plan';
import { encodeMp4, mixAudio } from './encode';
import { keepAwake, visibleGate, type Page, type WakeLockHost } from './stay-awake';

export type FrameSource = (times: number[], size: Size, onFrame: (bitmap: ImageBitmap, index: number) => Promise<void>, signal: AbortSignal) => Promise<void>;

export enum BrowserStage {
  Mixing = 'mixing',
  Rendering = 'rendering'
}

export type BrowserJob = {
  doc: MotionDoc;
  assetUrls: Record<string, string>;
  size: Size;
  withAudio: boolean;
  frames: FrameSource;
  signal: AbortSignal;
  onStage: (stage: BrowserStage) => void;
  onFrame: (done: number) => void;
  onPause: (paused: boolean) => void;
  host?: { nav: WakeLockHost; page: Page };
};

export async function renderInBrowser(job: BrowserJob): Promise<Blob> {
  const host = job.host ?? { nav: navigator as WakeLockHost, page: document };
  const release = await keepAwake(host.nav, host.page);
  try {
    job.onStage(BrowserStage.Mixing);
    const sounds = job.withAudio ? audioPlan(job.doc, job.assetUrls) : [];
    const audio = sounds.length ? await mixAudio(sounds, job.doc.durationInFrames / job.doc.fps) : null;

    job.onStage(BrowserStage.Rendering);
    const times = frameTimes(job.doc);
    return await encodeMp4({
      size: job.size,
      fps: job.doc.fps,
      frames: job.doc.durationInFrames,
      samples: samplesPerFrame(job.doc),
      audio,
      signal: job.signal,
      gate: visibleGate(host.page, job.onPause),
      render: (onFrame) => job.frames(times, job.size, onFrame, job.signal),
      onFrame: job.onFrame
    });
  } finally {
    release();
  }
}
