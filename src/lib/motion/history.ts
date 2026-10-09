import type { MotionDoc } from './doc';
import type { CustomSource } from './custom/component';
import { Agent } from './start-prompt';

export const HISTORY_LIMIT = 100;

export const UNSAVED_VERSION = 0;

export type History = { past: MotionDoc[]; present: MotionDoc; future: MotionDoc[] };

export function startHistory(doc: MotionDoc): History {
  return { past: [], present: doc, future: [] };
}

export function record(h: History, doc: MotionDoc): History {
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: doc, future: [] };
}

export function adoptHead(h: History, doc: MotionDoc, tabVersion: number): History {
  return tabVersion === UNSAVED_VERSION ? startHistory(doc) : record(h, doc);
}

export function undo(h: History, agent = Agent.Idle): History {
  const previous = h.past.at(-1);
  if (!previous || agent === Agent.Working) {
    return h;
  }
  return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] };
}

export function redo(h: History, agent = Agent.Idle): History {
  const [next, ...future] = h.future;
  if (!next || agent === Agent.Working) {
    return h;
  }
  return { past: [...h.past, h.present], present: next, future };
}

export function amend(h: History, doc: MotionDoc): History {
  return { ...h, present: doc, future: [] };
}

export function canUndo(h: History, agent = Agent.Idle): boolean {
  return agent === Agent.Idle && h.past.length > 0;
}

export function canRedo(h: History, agent = Agent.Idle): boolean {
  return agent === Agent.Idle && h.future.length > 0;
}

export function previousSource(h: History, name: string): CustomSource | null {
  const now = JSON.stringify(h.present.components[name]?.source ?? null);
  for (const doc of [...h.past].reverse()) {
    const source = doc.components?.[name]?.source;
    if (source && JSON.stringify(source) !== now) {
      return source;
    }
  }
  return null;
}
