import { fullShotOf } from './canvas-shot';
import type { Snap, SnapJob } from './canvas-snaps';

export const THUMB_WIDTH = 720;
export const MAX_SNAP_HEIGHT = 15000;
export const LOAD_TIMEOUT_MS = 20000;
export const SETTLE_MS = 600;

export const scaleOf = (width: number) => Math.min(1, THUMB_WIDTH / width);

const hide = (frame: HTMLIFrameElement, job: SnapJob) => {
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = `position:fixed;left:0;top:0;width:${job.device.w}px;height:${job.device.h}px;border:0;opacity:0;pointer-events:none;z-index:-1`;
};

const loaded = (frame: HTMLIFrameElement) =>
  new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), LOAD_TIMEOUT_MS);
    frame.addEventListener('load', () => (clearTimeout(timer), resolve(true)), { once: true });
  });

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function capturer(base: string) {
  return async (job: SnapJob): Promise<Snap | null> => {
    const frame = document.createElement('iframe');
    hide(frame, job);
    const ready = loaded(frame);
    frame.src = new URL(job.target, base).toString();
    document.body.appendChild(frame);

    try {
      if (!(await ready)) {
        console.warn(`[feega] Pages canvas: ${job.target} did not finish loading`);
        return null;
      }
      await pause(SETTLE_MS);
      const shot = await fullShotOf(frame, { scale: scaleOf(job.device.w), maxHeight: MAX_SNAP_HEIGHT });
      if ('reason' in shot) {
        console.warn(`[feega] Pages canvas: could not capture ${job.target}: ${shot.reason}`);
        return null;
      }

      return shot.snap;
    } finally {
      frame.remove();
    }
  };
}
