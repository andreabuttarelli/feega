import type { MotionDoc } from './doc';
import type { CustomSource } from './custom/component';
import { applyOps, diffDoc } from './doc-ops';
import { Agent } from './start-prompt';

export const HISTORY_LIMIT = 100;

export const UNSAVED_VERSION = 0;

export type Edit = { before: MotionDoc; after: MotionDoc };

export type History = { past: Edit[]; present: MotionDoc; future: Edit[] };

export function startHistory(doc: MotionDoc): History {
  return { past: [], present: doc, future: [] };
}

export function record(h: History, doc: MotionDoc): History {
  return { past: [...h.past, { before: h.present, after: doc }].slice(-HISTORY_LIMIT), present: doc, future: [] };
}

export function adoptHead(h: History, doc: MotionDoc, tabVersion: number): History {
  return tabVersion === UNSAVED_VERSION ? startHistory(doc) : record(h, doc);
}

export function followHead(h: History, doc: MotionDoc): History {
  return { ...h, present: doc };
}

function replay(present: MotionDoc, from: MotionDoc, to: MotionDoc): MotionDoc {
  return present === from ? to : applyOps(present, diffDoc(from, to));
}

export function undo(h: History, agent = Agent.Idle): History {
  const edit = h.past.at(-1);
  if (!edit || agent === Agent.Working) {
    return h;
  }
  return { past: h.past.slice(0, -1), present: replay(h.present, edit.after, edit.before), future: [edit, ...h.future] };
}

export function redo(h: History, agent = Agent.Idle): History {
  const [edit, ...future] = h.future;
  if (!edit || agent === Agent.Working) {
    return h;
  }
  return { past: [...h.past, edit], present: replay(h.present, edit.before, edit.after), future };
}

export function amend(h: History, doc: MotionDoc): History {
  const last = h.past.at(-1);
  if (!last) {
    return { ...h, present: doc, future: [] };
  }
  if (last.after !== h.present) {
    return record(h, doc);
  }
  return { past: [...h.past.slice(0, -1), { before: last.before, after: doc }], present: doc, future: [] };
}

export function canUndo(h: History, agent = Agent.Idle): boolean {
  return agent === Agent.Idle && h.past.length > 0;
}

export function canRedo(h: History, agent = Agent.Idle): boolean {
  return agent === Agent.Idle && h.future.length > 0;
}

export function previousSource(h: History, name: string): CustomSource | null {
  const now = JSON.stringify(h.present.components[name]?.source ?? null);
  for (const { before } of [...h.past].reverse()) {
    const source = before.components?.[name]?.source;
    if (source && JSON.stringify(source) !== now) {
      return source;
    }
  }
  return null;
}
