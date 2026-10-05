import type { MotionDoc } from './doc';
import { CREDITS_PER_USD_SUBSCRIPTION_LIST } from '$lib/credit-ladder';

export enum Resolution {
  P720 = '720p',
  P1080 = '1080p',
  P1440 = '1440p',
  P2160 = '2160p'
}

const SANDBOX_USD = { activeCpuHour: 0.128, memoryGbHour: 0.0212 };
const WORKER_MEMORY_GB = 8;
const SECONDS_PER_HOUR = 3600;
const MEASURED_1080P30 = { cpuSecondsPerSecond: 1.56, wallSecondsPerSecond: 1.32 };
const IDLE_WORKER_MINUTES = 3.5;
const CONTENT_MARGIN = 3;
const BASE_FPS = 30;
const FULL_HD_SHORT_SIDE = 1080;

const PIXELS_OF_1080P: Record<Resolution, number> = { [Resolution.P720]: 0.44, [Resolution.P1080]: 1, [Resolution.P1440]: 1.78, [Resolution.P2160]: 4 };

const usdPerSecond1080p =
  (MEASURED_1080P30.cpuSecondsPerSecond * SANDBOX_USD.activeCpuHour + MEASURED_1080P30.wallSecondsPerSecond * WORKER_MEMORY_GB * SANDBOX_USD.memoryGbHour) / SECONDS_PER_HOUR;
const fixedUsd = (IDLE_WORKER_MINUTES / 60) * WORKER_MEMORY_GB * SANDBOX_USD.memoryGbHour;

export type RenderQuote = { seconds: number; resolution: Resolution; credits: number };
type Quoted = Pick<MotionDoc, 'width' | 'height' | 'durationInFrames' | 'fps'> & Partial<Pick<MotionDoc, 'motionBlur'>>;

export function resolutionOf(doc: Pick<MotionDoc, 'width' | 'height'>): Resolution {
  return Math.min(doc.width, doc.height) >= FULL_HD_SHORT_SIDE ? Resolution.P1080 : Resolution.P720;
}

export function renderCostUsd(doc: Quoted, resolution: Resolution = resolutionOf(doc)): number {
  const seconds = doc.durationInFrames / doc.fps;
  const samples = doc.motionBlur?.enabled ? doc.motionBlur.samples : 1;
  const work = seconds * (doc.fps / BASE_FPS) * samples * PIXELS_OF_1080P[resolution] * usdPerSecond1080p;
  return (fixedUsd + work) * CONTENT_MARGIN;
}

export function renderQuote(doc: Quoted, resolution: Resolution = resolutionOf(doc)): RenderQuote {
  const seconds = doc.durationInFrames / doc.fps;
  return { seconds, resolution, credits: Math.ceil(renderCostUsd(doc, resolution) * CREDITS_PER_USD_SUBSCRIPTION_LIST) };
}
