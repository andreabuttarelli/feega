import { findClip, type MotionDoc } from './doc';
import { Action, type ActionId } from './actions';
import { clipName } from './organize';

const PRECOMP = 'Precomp';

export enum PickMode {
  One = 'one',
  Many = 'many'
}

const BASE: ActionId[] = [Action.Split, Action.Duplicate, Action.Delete];
const TAIL: ActionId[] = [Action.ParentTo, Action.SelectSeveral, Action.ClipProperties];

const isPrecomp = (doc: MotionDoc, id: string) => findClip(doc, id)?.clip.component === PRECOMP;

export function clipActions(doc: MotionDoc, selection: readonly string[]): ActionId[] {
  if (!selection.length) {
    return [];
  }
  const open = selection.length === 1 && isPrecomp(doc, selection[0]) ? [Action.OpenComp] : [];
  return [...BASE, ...open, ...TAIL];
}

export type ParentChoice = { id: string | null; name: string };

const NO_PARENT = 'None';

export function parentChoices(doc: MotionDoc, selection: readonly string[]): ParentChoice[] {
  const layers = doc.tracks.flatMap((t) => t.clips).filter((c) => !selection.includes(c.id));
  return [{ id: null, name: NO_PARENT }, ...layers.map((c) => ({ id: c.id, name: clipName(c) }))];
}
