import { SOURCE_ATTR } from './runtime.js';

const FRAME_MS = 16;

const sameRect = (a, b) => a && b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

export function trackRects(win, send) {
  const doc = win.document;
  const followed = new Map();
  const last = new Map();
  let queued = false;
  let sizes = null;

  const elementOf = (source) => doc.querySelector(`[${SOURCE_ATTR}=${JSON.stringify(source)}]`);

  function observeSizes() {
    sizes?.disconnect();
    if (!win.ResizeObserver) {
      return;
    }
    sizes = new win.ResizeObserver(schedule);
    for (const source of followed.values()) {
      const element = elementOf(source);
      if (element) {
        sizes.observe(element);
      }
    }
  }

  function measure() {
    queued = false;
    for (const [slot, source] of followed) {
      const element = elementOf(source);
      const box = element?.getBoundingClientRect();
      const rect = box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
      if (sameRect(rect, last.get(slot)) || (rect === null && last.get(slot) === null)) {
        continue;
      }
      last.set(slot, rect);
      send(slot, rect);
    }
  }

  function schedule() {
    if (queued) {
      return;
    }
    queued = true;
    (win.requestAnimationFrame ?? ((run) => win.setTimeout(run, FRAME_MS)))(measure);
  }

  new win.MutationObserver(() => (observeSizes(), schedule())).observe(doc.documentElement, { attributes: true, childList: true, characterData: true, subtree: true });
  win.addEventListener('scroll', schedule, { capture: true, passive: true });
  win.addEventListener('resize', schedule);
  win.addEventListener('load', schedule, { capture: true });

  return {
    follow(slot, source) {
      if (source) {
        followed.set(slot, source);
      } else {
        followed.delete(slot);
      }
      last.delete(slot);
      observeSizes();
      schedule();
    }
  };
}
