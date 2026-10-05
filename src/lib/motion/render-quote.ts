import type { MotionDoc, MotionTrack } from './doc';
import { CREDITS_PER_USD_GRANT } from '$lib/credit-ladder';
import { chunkPlan } from './server-render';

export enum Resolution {
  P720 = '720p',
  P1080 = '1080p',
  P1440 = '1440p',
  P2160 = '2160p'
}

export enum RenderClass {
  Flat = 'flat',
  Scene3D = '3d',
  Device3D = 'device3d'
}

export const RENDER_CALL_LABEL = 'motion_render';
export const RENDER_MULTIPLIER = 5;
export const HOLD_BUFFER = 1.5;
export const IDLE = { pieceMs: 30_000, headMs: 90_000 };

export type WorkerUsage = { cpuMs: number; memoryMb: number; wallMs: number };
export type RenderQuote = { seconds: number; resolution: Resolution; credits: number };

const SANDBOX_USD = { activeCpuHour: 0.128, memoryGbHour: 0.0212 };
const BILLED_MINIMUM_MS = 60_000;
const MS_PER_HOUR = 3_600_000;
const MB_PER_GB = 1024;
const MEMORY_MB = { chunked: 8192, whole: 16384 };
const BOOT = { wallS: 3.4, cpuS: 3 };
const CHUNKED_FPS: readonly number[] = [24, 30, 60];
const FULL_HD_SHORT_SIDE = 1080;
const S_TO_MS = 1000;

const PER_1080P_FRAME: Record<RenderClass, { cpuS: number; wallS: number }> = {
  [RenderClass.Flat]: { cpuS: 0.08, wallS: 0.04 },
  [RenderClass.Scene3D]: { cpuS: 1.8, wallS: 0.46 },
  [RenderClass.Device3D]: { cpuS: 4.6, wallS: 1.2 }
};

const RESOLUTION_WORK: Record<Resolution, number> = { [Resolution.P720]: 0.6, [Resolution.P1080]: 1, [Resolution.P1440]: 1.6, [Resolution.P2160]: 2.5 };

const CLASS_OF_COMPONENT: Record<string, RenderClass> = {
  Model3D: RenderClass.Scene3D,
  Shape3D: RenderClass.Scene3D,
  Text3D: RenderClass.Scene3D,
  Logo3D: RenderClass.Scene3D,
  Device3D: RenderClass.Device3D
};

const HEAVIEST: RenderClass[] = [RenderClass.Device3D, RenderClass.Scene3D];

type Quoted = Pick<MotionDoc, 'width' | 'height' | 'durationInFrames' | 'fps'> & Partial<Pick<MotionDoc, 'motionBlur' | 'tracks' | 'comps'>>;

export function resolutionOf(doc: Pick<MotionDoc, 'width' | 'height'>): Resolution {
  return Math.min(doc.width, doc.height) >= FULL_HD_SHORT_SIDE ? Resolution.P1080 : Resolution.P720;
}

export function renderClass(doc: Partial<Pick<MotionDoc, 'tracks' | 'comps'>>): RenderClass {
  const tracks: MotionTrack[] = [...(doc.tracks ?? []), ...Object.values(doc.comps ?? {}).flatMap((c) => (c as { tracks?: MotionTrack[] }).tracks ?? [])];
  const present = new Set(tracks.flatMap((t) => t.clips.map((c) => CLASS_OF_COMPONENT[c.component])));
  return HEAVIEST.find((c) => present.has(c)) ?? RenderClass.Flat;
}

export function frameWallSeconds(doc: Quoted, resolution: Resolution = resolutionOf(doc)): number {
  return PER_1080P_FRAME[renderClass(doc)].wallS * RESOLUTION_WORK[resolution];
}

export function sandboxCostUsd(usages: WorkerUsage[]): number {
  return usages.reduce((sum, u) => {
    const cpu = (u.cpuMs / MS_PER_HOUR) * SANDBOX_USD.activeCpuHour;
    const memory = (u.memoryMb / MB_PER_GB) * (Math.max(BILLED_MINIMUM_MS, u.wallMs) / MS_PER_HOUR) * SANDBOX_USD.memoryGbHour;
    return sum + cpu + memory;
  }, 0);
}

export function estimatedUsage(doc: Quoted, resolution: Resolution = resolutionOf(doc)): WorkerUsage[] {
  const samples = doc.motionBlur?.enabled ? doc.motionBlur.samples : 1;
  const whole = samples > 1 || !CHUNKED_FPS.includes(doc.fps);
  const plan = whole ? { size: doc.durationInFrames, count: 1 } : chunkPlan(doc.durationInFrames);
  const per = PER_1080P_FRAME[renderClass(doc)];
  const work = plan.size * samples * RESOLUTION_WORK[resolution];
  const piece = { cpuMs: (BOOT.cpuS + work * per.cpuS) * S_TO_MS, memoryMb: whole ? MEMORY_MB.whole : MEMORY_MB.chunked, wallMs: (BOOT.wallS + work * per.wallS) * S_TO_MS + IDLE.pieceMs };
  return Array.from({ length: plan.count }, (_, i) => (i === 0 ? { ...piece, wallMs: piece.wallMs + IDLE.headMs } : piece));
}

export function renderCostUsd(doc: Quoted, resolution: Resolution = resolutionOf(doc)): number {
  return sandboxCostUsd(estimatedUsage(doc, resolution));
}

export function creditsOfCost(costUsd: number): number {
  return Math.ceil(costUsd * RENDER_MULTIPLIER * CREDITS_PER_USD_GRANT);
}

export function renderQuote(doc: Quoted, resolution: Resolution = resolutionOf(doc)): RenderQuote {
  return { seconds: doc.durationInFrames / doc.fps, resolution, credits: creditsOfCost(renderCostUsd(doc, resolution)) };
}
