import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { IDENTITY, type Affine } from '@feega/motion-core/motion/parent';
import type { ListItem } from '@feega/motion-core/motion/text-lists';
import type { TextRun } from '@feega/motion-core/motion/text-runs';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { scoped } from './frame-scope';
import { commitText } from './frame-text-edit';

export type TextScope = { view: MotionDoc; id: string; merge: (view: MotionDoc) => MotionDoc; place: Affine };

export function textScope(doc: MotionDoc, sceneId: string, frame: number, here: string | null = null): TextScope | null {
  if (findClip(doc, sceneId)) {
    return { view: doc, id: sceneId, merge: (view) => view, place: IDENTITY };
  }
  const inside = scoped(doc, [sceneId], frame, here);
  return inside ? { view: inside.view, id: inside.ids[0], merge: inside.merge, place: inside.fromView } : null;
}

export function commitScoped(doc: MotionDoc, sceneId: string, text: string, runs: TextRun[], lists: ListItem[], frame: number, here: string | null = null): OpResult {
  const scope = textScope(doc, sceneId, frame, here);
  if (!scope) {
    return { ok: false, error: `${sceneId} is not in this frame` };
  }
  const typed = commitText(scope.view, scope.id, text, runs, lists);
  return typed.ok ? { ok: true, doc: scope.merge(typed.doc) } : typed;
}

export const doubledOn = (chain: readonly string[], picks: readonly string[], hit: string): string => (picks.length === 1 && chain.at(-1) === picks[0] ? picks[0] : hit);
