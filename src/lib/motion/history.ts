import type { MotionDoc } from './doc';

export const HISTORY_LIMIT = 100;

export type History = { past: MotionDoc[]; present: MotionDoc; future: MotionDoc[] };

export function startHistory(doc: MotionDoc): History {
  return { past: [], present: doc, future: [] };
}

export function record(h: History, doc: MotionDoc): History {
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: doc, future: [] };
}

export function undo(h: History): History {
  const previous = h.past.at(-1);
  if (!previous) {
    return h;
  }
  return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] };
}

export function redo(h: History): History {
  const [next, ...future] = h.future;
  if (!next) {
    return h;
  }
  return { past: [...h.past, h.present], present: next, future };
}

export function amend(h: History, doc: MotionDoc): History {
  return { ...h, present: doc, future: [] };
}

export function canUndo(h: History): boolean {
  return h.past.length > 0;
}

export function canRedo(h: History): boolean {
  return h.future.length > 0;
}
