import { gapToCentre, touches, type Placed } from './canvas-live';
import type { CanvasView, Viewport } from './canvas-view';

export const SNAP_CONCURRENCY = 2;
const OFF_SCREEN_PENALTY = 1e9;
const NO_MARGIN = 0;

export type SnapJob = Placed & { target: string; device: Viewport };

export type Snap = { url: string; height: number; capped: boolean };

export type StoredSnap = Snap & { target: string; width: number };

type Props = {
  max: number;
  capture: (job: SnapJob) => Promise<Snap | null>;
  changed: () => void;
  store?: Map<string, StoredSnap>;
};

export function snapQueue({ max, capture, changed, store = new Map() }: Props) {
  const snaps = store;
  const failed = new Set<string>();
  const outdated = new Set<string>();
  const running = new Map<string, number>();
  const generation = new Map<string, number>();
  let jobs: SnapJob[] = [];
  let view: CanvasView = { scale: 1, x: 0, y: 0 };
  let viewport: Viewport = { w: 0, h: 0 };

  const generationOf = (key: string) => generation.get(key) ?? 0;
  const fresh = (job: SnapJob) => snaps.get(job.key)?.target === job.target && snaps.get(job.key)?.width === job.device.w && !outdated.has(job.key);
  const waiting = (job: SnapJob) => !fresh(job) && !failed.has(job.key) && !running.has(job.key);
  const rank = (job: SnapJob) => gapToCentre(job, view, viewport) + (touches(job, view, viewport, NO_MARGIN) ? 0 : OFF_SCREEN_PENALTY);

  function pump() {
    while (running.size < max) {
      const next = jobs.filter(waiting).sort((a, b) => rank(a) - rank(b))[0];
      if (!next) {
        return;
      }
      start(next);
    }
  }

  function start(job: SnapJob) {
    const born = generationOf(job.key);
    running.set(job.key, born);
    void capture(job)
      .catch(() => null)
      .then((snap) => settle(job, born, snap));
  }

  function settle(job: SnapJob, born: number, snap: Snap | null) {
    running.delete(job.key);
    if (born !== generationOf(job.key)) {
      pump();
      return;
    }
    outdated.delete(job.key);
    if (snap) {
      snaps.set(job.key, { ...snap, target: job.target, width: job.device.w });
    } else {
      failed.add(job.key);
    }
    changed();
    pump();
  }

  function want(next: SnapJob[], nextView: CanvasView, nextViewport: Viewport) {
    jobs = next;
    view = nextView;
    viewport = nextViewport;
    pump();
  }

  function invalidate(keys: string[]) {
    for (const key of keys) {
      generation.set(key, generationOf(key) + 1);
      outdated.add(key);
      failed.delete(key);
    }
    pump();
  }

  return { snaps, failed, want, invalidate };
}
