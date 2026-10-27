import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { Action, type ActionId } from './actions';
import { clipName } from '@feega/motion-core/motion/organize';

const PRECOMP = 'Precomp';

export enum PickMode {
  One = 'one',
  Many = 'many'
}

const BASE: ActionId[] = [Action.Split, Action.Duplicate, Action.Delete, Action.FlipHorizontal, Action.FlipVertical];
const TAIL: ActionId[] = [Action.ParentTo, Action.SelectSeveral, Action.ClipProperties];

const isPrecomp = (doc: MotionDoc, id: string) => findClip(doc, id)?.clip.component === PRECOMP;

export function clipActions(doc: MotionDoc, selection: readonly string[]): ActionId[] {
  if (!selection.length) {
    return [];
  }
  const open = selection.length === 1 && isPrecomp(doc, selection[0]) ? [Action.OpenComp] : [];
  return [...BASE, ...open, ...TAIL];
}

export const barActions = (doc: MotionDoc, selection: readonly string[], extra: readonly ActionId[]): ActionId[] => [...new Set([...clipActions(doc, selection), ...extra])];

export type ParentChoice = { id: string | null; name: string };

const NO_PARENT = 'None';

export function parentChoices(doc: MotionDoc, selection: readonly string[]): ParentChoice[] {
  const layers = doc.tracks.flatMap((t) => t.clips).filter((c) => !selection.includes(c.id));
  return [{ id: null, name: NO_PARENT }, ...layers.map((c) => ({ id: c.id, name: clipName(c) }))];
}

export enum Placement {
  Inline = 'inline',
  Structure = 'structure',
  Shape = 'shape',
  Clip = 'clip',
  Danger = 'danger',
  Dropped = 'dropped'
}

const MENU_ORDER: readonly Placement[] = [Placement.Structure, Placement.Shape, Placement.Clip, Placement.Danger];

const PLACEMENT: Partial<Record<ActionId, Placement>> = {
  [Action.Duplicate]: Placement.Inline,
  [Action.CreateComponent]: Placement.Structure,
  [Action.DetachInstance]: Placement.Structure,
  [Action.PushInstance]: Placement.Structure,
  [Action.ResetInstance]: Placement.Structure,
  [Action.Group]: Placement.Structure,
  [Action.Ungroup]: Placement.Structure,
  [Action.FrameSelection]: Placement.Structure,
  [Action.ResizeToFit]: Placement.Structure,
  [Action.AutoLayout]: Placement.Structure,
  [Action.Union]: Placement.Shape,
  [Action.Subtract]: Placement.Shape,
  [Action.Intersect]: Placement.Shape,
  [Action.Exclude]: Placement.Shape,
  [Action.Flatten]: Placement.Shape,
  [Action.OutlineStroke]: Placement.Shape,
  [Action.TextToPath]: Placement.Shape,
  [Action.Split]: Placement.Clip,
  [Action.OpenComp]: Placement.Clip,
  [Action.Delete]: Placement.Danger,
  [Action.FlipHorizontal]: Placement.Dropped,
  [Action.FlipVertical]: Placement.Dropped,
  [Action.ParentTo]: Placement.Dropped,
  [Action.SelectSeveral]: Placement.Dropped,
  [Action.ClipProperties]: Placement.Dropped
};

const placementOf = (id: ActionId): Placement => PLACEMENT[id] ?? Placement.Clip;

export const headerActions = (actions: readonly ActionId[]): { inline: ActionId[]; groups: ActionId[][] } => ({
  inline: actions.filter((id) => placementOf(id) === Placement.Inline),
  groups: MENU_ORDER.map((place) => actions.filter((id) => placementOf(id) === place)).filter((group) => group.length > 0)
});
