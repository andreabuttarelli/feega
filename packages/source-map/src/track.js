import { SOURCE_ATTR } from './runtime.js';

const FRAME_MS = 16;

const sameRect = (a, b) => a && b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

export function trackRects(win, send) {
  const doc = win.document;
  const followed = new Map();
  const last = new Map();
  let queued = false;
  let sizes = null;

  const elementOf = ({ source, index }) => {
    const found = doc.querySelectorAll(`[${SOURCE_ATTR}=${JSON.stringify(source)}]`);
    return found[index] ?? found[0] ?? null;
  };

  function observeSizes() {
    sizes?.disconnect();
    if (!win.ResizeObserver) {
      return;
    }
    sizes = new win.ResizeObserver(schedule);
    for (const target of followed.values()) {
      const element = elementOf(target);
      if (element) {
        sizes.observe(element);
      }
    }
  }

  function measure() {
    queued = false;
    for (const [slot, target] of followed) {
      const element = elementOf(target);
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
    follow(slot, source, index = 0) {
      if (source) {
        followed.set(slot, { source, index });
      } else {
        followed.delete(slot);
      }
      last.delete(slot);
      observeSizes();
      schedule();
    }
  };
}
