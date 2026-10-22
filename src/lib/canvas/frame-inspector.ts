import { findClip, type MotionClip, type MotionDoc } from '$lib/motion/doc';
import { Action, type ActionId } from '$lib/motion/actions';
import { ClipOp, runClipOp, type ClipDone } from '$lib/motion/clip-ops';
import { PropertiesView } from '$lib/motion/properties-view';
import { isLockedComp } from '$lib/motion/template/library';

export type InspectorShown = { view: PropertiesView.Clip | PropertiesView.Template; clip: MotionClip } | { view: PropertiesView.Multiple; clip: null };

export function inspectorOf(doc: MotionDoc, selection: readonly string[]): InspectorShown | null {
  const present = selection.filter((id) => findClip(doc, id));
  if (present.length > 1) {
    return { view: PropertiesView.Multiple, clip: null };
  }
  const found = present.length === 1 ? findClip(doc, present[0]) : null;
  if (!found) {
    return null;
  }
  const template = found.clip.component === 'Precomp' && isLockedComp(doc, String(found.clip.props.comp));
  return { view: template ? PropertiesView.Template : PropertiesView.Clip, clip: found.clip };
}

const BAR_OPS: Partial<Record<ActionId, ClipOp>> = {
  [Action.Split]: ClipOp.Split,
  [Action.Duplicate]: ClipOp.Duplicate,
  [Action.Delete]: ClipOp.Delete
};

type BarCtx = { doc: MotionDoc; selection: readonly string[]; frame: number; newId: () => string };

export function barAction(id: ActionId, ctx: BarCtx): Extract<ClipDone, { ok: true }> | null {
  const op = BAR_OPS[id];
  const done = op ? runClipOp(op, { ...ctx, parent: null }) : null;
  return done?.ok ? done : null;
}
