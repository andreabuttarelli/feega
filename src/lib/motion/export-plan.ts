import type { MotionDoc } from './doc';
import { Resolution } from './render-quote';

export enum Support {
  Full = 'full',
  Only720 = 'only-720',
  None = 'none'
}

export enum AudioMode {
  On = 'on',
  Unavailable = 'unavailable',
  Off = 'off'
}

export type Capabilities = { webCodecs: boolean; h264: boolean; h264At720: boolean; aac: boolean };
export type ExportSupport = { support: Support; audio: AudioMode };
export type Size = { width: number; height: number };

const SHORT_SIDE: Record<Resolution, number> = { [Resolution.P720]: 720, [Resolution.P1080]: 1080 };
const MS_PER_S = 1000;

const even = (n: number) => Math.round(n / 2) * 2;

export function exportSize(doc: Pick<MotionDoc, 'width' | 'height'>, resolution: Resolution): Size {
  const factor = Math.min(1, SHORT_SIDE[resolution] / Math.min(doc.width, doc.height));
  return { width: even(doc.width * factor), height: even(doc.height * factor) };
}

export function frameTimes(doc: Pick<MotionDoc, 'durationInFrames' | 'fps'>): number[] {
  return Array.from({ length: doc.durationInFrames }, (_, i) => i / doc.fps);
}

export function eta(progress: { done: number; total: number; elapsedMs: number }): number | null {
  if (progress.done <= 0) {
    return null;
  }
  return Math.round(((progress.elapsedMs / progress.done) * (progress.total - progress.done)) / MS_PER_S);
}

function videoSupport(c: Capabilities): Support {
  if (!c.webCodecs) {
    return Support.None;
  }
  if (c.h264) {
    return Support.Full;
  }
  return c.h264At720 ? Support.Only720 : Support.None;
}

export function exportSupport(c: Capabilities): ExportSupport {
  const support = videoSupport(c);
  if (support === Support.None) {
    return { support, audio: AudioMode.Off };
  }
  return { support, audio: c.aac ? AudioMode.On : AudioMode.Unavailable };
}

export type ExportScope = { orgId: string; projectId: string; nodeId: string };

export function exportFolder(scope: ExportScope): string {
  return `${scope.orgId}/${scope.projectId}/motion/${scope.nodeId}/`;
}

export function exportPath(scope: ExportScope, id: string): string {
  return `${exportFolder(scope)}${id}.mp4`;
}
