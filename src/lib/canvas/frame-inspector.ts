import { findClip, type MotionClip, type MotionDoc } from '$lib/motion/doc';
import { Action, type ActionId } from '$lib/motion/actions';
import { ClipOp, runClipOp, type ClipDone } from '$lib/motion/clip-ops';
import { PropertiesView } from '$lib/motion/properties-view';
import { isLockedComp } from '$lib/motion/template/library';
import { Flip, flipClips } from '$lib/motion/layer-props';

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

const BAR_FLIPS: Partial<Record<ActionId, { flip: Flip; summary: string }>> = {
  [Action.FlipHorizontal]: { flip: Flip.Horizontal, summary: 'Flipped horizontally' },
  [Action.FlipVertical]: { flip: Flip.Vertical, summary: 'Flipped vertically' }
};

function flipped(id: ActionId, ctx: BarCtx): ClipDone | null {
  const flip = BAR_FLIPS[id];
  const result = flip ? flipClips(ctx.doc, ctx.selection, flip.flip) : null;
  if (!flip || !result) {
    return null;
  }
  return result.ok ? { ok: true, doc: result.doc, summary: flip.summary, selection: [...ctx.selection] } : result;
}

export function barAction(id: ActionId, ctx: BarCtx): Extract<ClipDone, { ok: true }> | null {
  const op = BAR_OPS[id];
  const done = op ? runClipOp(op, { ...ctx, parent: null }) : flipped(id, ctx);
  return done?.ok ? done : null;
}
