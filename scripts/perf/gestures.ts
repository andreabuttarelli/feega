import type { CDPSession } from '@playwright/test';

export const FRAME_MS = 1000 / 120;
export const WHEEL_ZOOM = 0.01;
const CTRL = 2;
const TAIL_SPANS = 5;

export type Point = { x: number; y: number };
export type Step = { at: number; dx: number; dy: number; ctrl: boolean; x: number; y: number };
export type DragPoint = { at: number; x: number; y: number };
type ZoomLeg = { to: number; ms: number };

export enum Ease {
  Smooth = 'smooth',
  Flick = 'flick'
}
type PanLeg = { by: Point; ms: number };

const smoother = (t: number) => t * t * t * (t * (6 * t - 15) + 10);
const EASES: Record<Ease, (t: number) => number> = { [Ease.Smooth]: smoother, [Ease.Flick]: (t) => 1 - (1 - t) ** 4 };
const ticks = (ms: number) => Math.max(1, Math.round(ms / FRAME_MS));

export function zoomPath({ from, legs, anchor, ease = Ease.Smooth, clamp = { min: 0, max: Infinity } }: { from: number; legs: ZoomLeg[]; anchor: Point; ease?: Ease; clamp?: { min: number; max: number } }): Step[] {
  const curve = EASES[ease];
  const steps: Step[] = [];
  let zoom = from;
  for (const leg of legs) {
    const n = ticks(leg.ms);
    const span = Math.log(leg.to) - Math.log(zoom);
    for (let i = 1; i <= n; i++) {
      const dLog = span * (curve(i / n) - curve((i - 1) / n));
      steps.push({ at: steps.length * FRAME_MS, dx: 0, dy: -dLog / WHEEL_ZOOM, ctrl: true, ...anchor });
    }
    zoom = Math.min(clamp.max, Math.max(clamp.min, leg.to));
  }
  return steps;
}

const legPositions = (legs: PanLeg[], easeLast: (t: number) => number) =>
  legs.flatMap((leg, li) => {
    const ease = li === legs.length - 1 ? easeLast : smoother;
    const n = ticks(leg.ms);
    return Array.from({ length: n }, (_, k) => {
      const share = ease((k + 1) / n) - ease(k / n);
      return { x: leg.by.x * share, y: leg.by.y * share };
    });
  });

export function panPath({ legs, tailMs, at }: { legs: PanLeg[]; tailMs: number; at: Point }): Step[] {
  const moves = legPositions(legs, (t) => t * t);
  const last = moves.at(-1) ?? { x: 0, y: 0 };
  const n = ticks(tailMs);
  const tail = Array.from({ length: n }, (_, k) => {
    const decay = Math.exp((-TAIL_SPANS * (k + 1)) / n);
    return { x: last.x * decay, y: last.y * decay };
  });
  return [...moves, ...tail].map((d, i) => ({ at: i * FRAME_MS, dx: d.x, dy: d.y, ctrl: false, ...at }));
}

export function dragPan({ legs, at }: { legs: PanLeg[]; at: Point }): DragPoint[] {
  const points: DragPoint[] = [{ at: 0, ...at }];
  for (const d of legPositions(legs, smoother)) {
    const prev = points.at(-1)!;
    points.push({ at: points.length * FRAME_MS, x: prev.x + d.x, y: prev.y + d.y });
  }
  return points;
}

async function paced<T extends { at: number }>(items: T[], send: (item: T) => Promise<unknown>) {
  const started = performance.now();
  for (const item of items) {
    const wait = item.at - (performance.now() - started);
    if (wait > 1) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    await send(item);
  }
}

export const playWheel = (cdp: CDPSession, steps: Step[]) =>
  paced(steps, (s) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: s.x, y: s.y, deltaX: s.dx, deltaY: s.dy, modifiers: s.ctrl ? CTRL : 0 }));

export async function playDrag(cdp: CDPSession, points: DragPoint[], button: 'middle' | 'left') {
  const [first, ...rest] = points;
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: first.x, y: first.y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: first.x, y: first.y, button, clickCount: 1 });
  await paced(rest, (p) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button }));
  const end = points.at(-1)!;
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: end.x, y: end.y, button, clickCount: 1 });
}
