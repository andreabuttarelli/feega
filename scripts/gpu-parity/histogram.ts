import type { Gap } from '$lib/motion/gpu-full/display-list';

export type FrameGaps = { id: string; gaps: readonly Gap[] };
export type Row = { reason: string; gaps: number; frames: number; only: number };

const CUSTOM = 'Custom';

export const reasonOf = (gap: Gap): string => (gap.component === CUSTOM ? 'custom' : gap.reason);

export function histogram(frames: readonly FrameGaps[]): Row[] {
  const rows = new Map<string, Row>();
  for (const frame of frames) {
    const reasons = frame.gaps.map(reasonOf);
    const distinct = new Set(reasons);
    for (const reason of reasons) {
      const row = rows.get(reason) ?? { reason, gaps: 0, frames: 0, only: 0 };
      row.gaps += 1;
      rows.set(reason, row);
    }
    for (const reason of distinct) {
      const row = rows.get(reason)!;
      row.frames += 1;
      row.only += distinct.size === 1 ? 1 : 0;
    }
  }
  return [...rows.values()].sort((a, b) => b.frames - a.frames || b.gaps - a.gaps);
}
