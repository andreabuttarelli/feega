import { compOf, findClip, type MotionClip, type MotionDoc } from '$lib/motion/doc';
import { Action, type ActionId } from '$lib/motion/actions';
import { ClipOp, runClipOp, type ClipDone } from '$lib/motion/clip-ops';
import { groupClips, ungroupClip } from '$lib/motion/group';
import { addAutoLayout, removeAutoLayout, resizeToFit, wrapInFrame } from '$lib/motion/layout/ops';
import { isText } from '$lib/motion/layout/text-extent';
import { Flip, flipClips } from '$lib/motion/layer-props';
import { copyStyle, pasteStyle } from '$lib/motion/style-copy';
import { replaceElements } from '$lib/motion/move-element';
import { elementClipboard } from './element-clipboard.svelte';
import { setClipFlags } from '$lib/motion/organize';
import { BooleanOp, flattenShapes } from '$lib/motion/shape/boolean';
import { bakeBooleanGroup, isBooleanGroup, liveCombine } from '$lib/motion/shape/boolean-group';
import { outlineStrokes } from '$lib/motion/shape/outline-stroke';
import { outlineTexts, type OutlinerLoader } from '$lib/motion/text-outline-run';
import { setProps, setTransform, type OpResult } from '$lib/motion/timeline';
import { Command, OPACITY_KEYS, commandFor } from '$lib/motion/shortcuts';
import { Same, matchingLayers, sameLayers } from '$lib/motion/select-matching';
import { FRAME_MENU_IDS, frameMenuRun } from '$lib/motion/frame-menu';
import type { SelectionActionId } from './selection-actions';
import { siblingsOf } from './frame-select';
import { EditMode } from '$lib/motion/edit-mode';
import { propBoxes, tidySpace } from '$lib/motion/space';
import { PropertiesView } from '$lib/motion/properties-view';
import type { CompPath } from '$lib/motion/precomp';
import { scopeView } from '$lib/motion/instance-view';
import { scopeOf } from './frame-scope';
import { isLockedComp } from '$lib/motion/template/library';
import { createComponent, detachInstance, instanceOf, pushOverrides, resetOverrides } from '$lib/motion/main-component';

export type InspectorShown = { view: PropertiesView.Clip | PropertiesView.Template; clip: MotionClip; path: CompPath; hosts: readonly string[] } | { view: PropertiesView.Multiple; clip: null; path: CompPath; hosts: readonly string[] };

export function inspectorOf(doc: MotionDoc, selection: readonly string[]): InspectorShown | null {
  const present = selection.flatMap((id) => scopeOf(doc, id) ?? []);
  if (present.length > 1) {
    return { view: PropertiesView.Multiple, clip: null, path: [], hosts: [] };
  }
  const { path, hosts } = present[0]?.scope ?? { path: [], hosts: [] };
  const found = present.length === 1 ? findClip(scopeView(doc, { path, hosts }), present[0].id) : null;
  if (!found) {
    return null;
  }
  const template = found.clip.component === 'Precomp' && isLockedComp(doc, String(found.clip.props.comp));
  return { view: template ? PropertiesView.Template : PropertiesView.Clip, clip: found.clip, path, hosts };
}

type BarCtx = { doc: MotionDoc; selection: readonly string[]; frame: number; newId: () => string };
type Done = Extract<ClipDone, { ok: true }>;
type BarOp = { shown: (doc: MotionDoc, selection: readonly string[]) => boolean; run: (ctx: BarCtx) => Done | null };

const CAPTION = 'Caption';
const SHAPE = 'Shape';
const MIN_COMBINED = 2;

const clipsOf = (doc: MotionDoc, ids: readonly string[]) => ids.flatMap((id) => findClip(doc, id)?.clip ?? []);
const topIds = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips.map((c) => c.id));
const isShape = (clip: MotionClip) => clip.component === SHAPE;
const isOutlinable = (clip: MotionClip) => isText(clip.component) && clip.component !== CAPTION;

const any = () => true;
const several = (_doc: MotionDoc, selection: readonly string[]) => selection.length >= MIN_COMBINED;
const oneGroup = (doc: MotionDoc, selection: readonly string[]) => selection.length === 1 && clipsOf(doc, selection).some((c) => compOf(c));
const shapes = (least: number) => (doc: MotionDoc, selection: readonly string[]) => {
  const clips = clipsOf(doc, selection);
  return clips.length >= least && clips.every(isShape);
};
const someShape = (doc: MotionDoc, selection: readonly string[]) => clipsOf(doc, selection).some(isShape);
const allText = (doc: MotionDoc, selection: readonly string[]) => {
  const clips = clipsOf(doc, selection);
  return clips.length > 0 && clips.every(isOutlinable);
};

function done(result: OpResult, summary: string, selection: string[]): Done | null {
  return result.ok ? { ok: true, doc: result.doc, summary, selection } : null;
}

const kept = (ctx: BarCtx, result: OpResult, summary: string) => done(result, summary, result.ok ? ctx.selection.filter((id) => findClip(result.doc, id)) : []);

function regrouped(ctx: BarCtx, result: OpResult, summary: string): Done | null {
  const before = new Set(topIds(ctx.doc));
  return done(result, summary, result.ok ? topIds(result.doc).filter((id) => !before.has(id)) : []);
}

function framed(ctx: BarCtx): Done | null {
  const container = ctx.newId();
  return done(wrapInFrame(ctx.doc, ctx.selection, container, ctx.newId()), 'Framed the selection', [container]);
}

function autoLayout(ctx: BarCtx): Done | null {
  const lone = ctx.selection.length === 1 ? findClip(ctx.doc, ctx.selection[0])?.clip : null;
  if (lone?.autoLayout) {
    return done(removeAutoLayout(ctx.doc, lone.id), 'Removed auto layout', [lone.id]);
  }
  const { result, containerId } = addAutoLayout(ctx.doc, ctx.selection, ctx.newId);
  return done(result, 'Added auto layout', [containerId]);
}

const clipOp = (op: ClipOp): BarOp => ({ shown: any, run: (ctx) => {
  const result = runClipOp(op, { ...ctx, parent: null });
  return result.ok ? result : null;
} });

const loneBooleanGroup = (doc: MotionDoc, selection: readonly string[]): MotionClip | null => {
  const [clip] = selection.length === 1 ? clipsOf(doc, selection) : [];
  return clip && isBooleanGroup(clip) ? clip : null;
};

const combine = (op: BooleanOp): BarOp => ({
  shown: (doc, selection) => shapes(MIN_COMBINED)(doc, selection) || loneBooleanGroup(doc, selection) !== null,
  run: (ctx) => {
    const group = loneBooleanGroup(ctx.doc, ctx.selection);
    if (group) {
      return kept(ctx, setProps(ctx.doc, group.id, { boolean: op }), `Changed boolean to ${op}`);
    }
    return regrouped(ctx, liveCombine(ctx.doc, ctx.selection, op, ctx.newId), `Combined shapes: ${op}`);
  }
});

const flattenOp: BarOp = {
  shown: (doc, selection) => shapes(1)(doc, selection) || loneBooleanGroup(doc, selection) !== null,
  run: (ctx) => {
    const group = loneBooleanGroup(ctx.doc, ctx.selection);
    if (group) {
      return regrouped(ctx, bakeBooleanGroup(ctx.doc, group.id, ctx.newId), 'Flattened boolean group');
    }
    return kept(ctx, flattenShapes(ctx.doc, ctx.selection, ctx.frame), 'Flattened shapes');
  }
};

const flip = (way: Flip, summary: string): BarOp => ({ shown: any, run: (ctx) => kept(ctx, flipClips(ctx.doc, ctx.selection, way), summary) });

const oneInstance = (doc: MotionDoc, selection: readonly string[]) => selection.length === 1 && instanceOf(doc, selection[0]) !== null;
const COMPONENT_NAME = 'Component';
const componentName = (doc: MotionDoc) => `${COMPONENT_NAME} ${Object.values(doc.comps).filter((c) => c.component).length + 1}`;

type Flag = 'hidden' | 'locked';

function toggleFlag(ctx: BarCtx, flag: Flag, summary: string): Done | null {
  const on = !ctx.selection.every((id) => findClip(ctx.doc, id)?.clip[flag]);
  const result = ctx.selection.reduce<OpResult>((r, id) => (r.ok ? setClipFlags(r.doc, id, { [flag]: on }) : r), { ok: true, doc: ctx.doc });
  return kept(ctx, result, summary);
}

function copyProperties(ctx: BarCtx): null {
  const clip = findClip(ctx.doc, ctx.selection[0])?.clip;
  if (clip) {
    elementClipboard.copyStyle(copyStyle(clip));
  }
  return null;
}

function pasteProperties(ctx: BarCtx): Done | null {
  const copied = elementClipboard.style;
  return copied ? kept(ctx, pasteStyle(ctx.doc, ctx.selection, copied), 'Pasted properties') : null;
}

function pasteReplace(ctx: BarCtx): Done | null {
  const copied = elementClipboard.elements;
  const replaced = copied ? replaceElements(ctx.doc, ctx.selection, copied.elements, ctx.newId) : null;
  return replaced?.ok ? { ok: true, doc: replaced.doc, summary: 'Pasted to replace', selection: replaced.ids } : null;
}

const opacityOp = (opacity: number): BarOp => ({ shown: any, run: (ctx) => kept(ctx, ctx.selection.reduce<OpResult>((r, id) => (r.ok ? setTransform(r.doc, id, { opacity }) : r), { ok: true, doc: ctx.doc }), `Opacity ${Math.round(opacity * 100)}%`) });

const OPACITY_OPS = Object.fromEntries(OPACITY_KEYS.map((o) => [o.command, opacityOp(o.opacity)]));

const BAR_OPS: Partial<Record<ActionId, BarOp>> = {
  ...OPACITY_OPS,
  [Action.TidyUp]: { shown: several, run: (ctx) => kept(ctx, tidySpace(ctx.doc, ctx.selection, ctx.frame, propBoxes(ctx.doc), EditMode.Design), 'Tidied up') },
  [Action.CreateComponent]: { shown: any, run: (ctx) => regrouped(ctx, createComponent(ctx.doc, ctx.selection, ctx.newId, componentName(ctx.doc)), 'Created a component') },
  [Action.DetachInstance]: { shown: oneInstance, run: (ctx) => kept(ctx, detachInstance(ctx.doc, ctx.selection[0], ctx.newId), 'Detached the instance') },
  [Action.PushInstance]: { shown: oneInstance, run: (ctx) => kept(ctx, pushOverrides(ctx.doc, ctx.selection[0]), 'Pushed overrides to the main component') },
  [Action.ResetInstance]: { shown: oneInstance, run: (ctx) => kept(ctx, resetOverrides(ctx.doc, ctx.selection[0]), 'Reset all overrides') },
  [Action.Split]: clipOp(ClipOp.Split),
  [Action.Duplicate]: clipOp(ClipOp.Duplicate),
  [Action.Delete]: clipOp(ClipOp.Delete),
  [Action.Group]: { shown: several, run: (ctx) => (ctx.selection.length >= MIN_COMBINED ? regrouped(ctx, groupClips(ctx.doc, ctx.selection, ctx.newId), 'Grouped') : null) },
  [Action.Ungroup]: { shown: oneGroup, run: (ctx) => (ctx.selection.length === 1 ? regrouped(ctx, ungroupClip(ctx.doc, ctx.selection[0], ctx.newId), 'Ungrouped') : null) },
  [Action.FrameSelection]: { shown: any, run: framed },
  [Action.ResizeToFit]: { shown: any, run: (ctx) => kept(ctx, resizeToFit(ctx.doc, ctx.selection[0]), 'Resized the frame to fit') },
  [Action.AutoLayout]: { shown: any, run: autoLayout },
  [Action.Union]: combine(BooleanOp.Union),
  [Action.Subtract]: combine(BooleanOp.Subtract),
  [Action.Intersect]: combine(BooleanOp.Intersect),
  [Action.Exclude]: combine(BooleanOp.Exclude),
  [Action.Flatten]: flattenOp,
  [Action.OutlineStroke]: { shown: someShape, run: (ctx) => kept(ctx, outlineStrokes(ctx.doc, ctx.selection, ctx.frame, ctx.newId), 'Outlined the stroke') },
  [Action.FlipHorizontal]: flip(Flip.Horizontal, 'Flipped horizontally'),
  [Action.FlipVertical]: flip(Flip.Vertical, 'Flipped vertically'),
  [Action.CopyProperties]: { shown: any, run: copyProperties },
  [Action.PasteProperties]: { shown: any, run: pasteProperties },
  [Action.PasteReplace]: { shown: any, run: pasteReplace },
  [Action.ToggleHidden]: { shown: any, run: (ctx) => toggleFlag(ctx, 'hidden', 'Toggled visibility') },
  [Action.ToggleLocked]: { shown: any, run: (ctx) => toggleFlag(ctx, 'locked', 'Toggled lock') }
};

export type LaterCtx = BarCtx & { load: OutlinerLoader; assets: Record<string, string> };

type LaterOp = { shown: BarOp['shown']; run: (ctx: LaterCtx) => Promise<Done | null> };

const LATER_OPS: Partial<Record<ActionId, LaterOp>> = {
  [Action.TextToPath]: { shown: allText, run: async (ctx) => kept(ctx, await outlineTexts(ctx.doc, ctx.selection, ctx.load, ctx.assets), 'Outlined text') }
};

const STRUCTURE_ORDER: readonly ActionId[] = [Action.CreateComponent, Action.DetachInstance, Action.PushInstance, Action.ResetInstance, Action.Group, Action.Ungroup, Action.FrameSelection, Action.ResizeToFit, Action.AutoLayout, Action.Union, Action.Subtract, Action.Intersect, Action.Exclude, Action.Flatten, Action.OutlineStroke, Action.TextToPath, Action.FlipHorizontal, Action.FlipVertical];

export const FRAME_STRUCTURE_ACTIONS: ReadonlySet<ActionId> = new Set(STRUCTURE_ORDER);

export function frameBarActions(doc: MotionDoc, selection: readonly string[]): ActionId[] {
  if (!selection.length) {
    return [];
  }
  return STRUCTURE_ORDER.filter((id) => (BAR_OPS[id] ?? LATER_OPS[id])?.shown(doc, selection));
}

export function barAction(id: ActionId, ctx: BarCtx): Done | null {
  return BAR_OPS[id]?.run(ctx) ?? null;
}

export async function barActionLater(id: ActionId, ctx: LaterCtx): Promise<Done | null> {
  const later = LATER_OPS[id];
  return later ? later.run(ctx) : barAction(id, ctx);
}

const PICKS: Partial<Record<ActionId, (doc: MotionDoc, picks: readonly string[]) => string[]>> = {
  [Command.SelectMatching]: matchingLayers,
  [Command.SelectSameFill]: (doc, picks) => sameLayers(doc, picks, Same.Fill),
  [Command.SelectSameStroke]: (doc, picks) => sameLayers(doc, picks, Same.Stroke),
  [Command.SelectSameFont]: (doc, picks) => sameLayers(doc, picks, Same.Font),
  [Command.SelectSameEffect]: (doc, picks) => sameLayers(doc, picks, Same.Effect),
  [Command.SelectAll]: siblingsOf
};

export const picksFor = (id: ActionId, doc: MotionDoc, picks: readonly string[]): string[] | null => PICKS[id]?.(doc, picks) ?? null;

const runs = (id: ActionId) => id in BAR_OPS || id in LATER_OPS || id in PICKS;

export const canRunInFrame = runs;

export const frameMenuAction = (id: SelectionActionId): ActionId | null => {
  const run = frameMenuRun(id);
  return run && 'command' in run ? run.command : null;
};

export const FRAME_ELEMENT_MENU: ReadonlySet<SelectionActionId> = new Set(
  [...FRAME_MENU_IDS].filter((id) => {
    const action = frameMenuAction(id);
    return action !== null && runs(action);
  })
);

const FRAME_KEYS: ReadonlySet<ActionId> = new Set([...STRUCTURE_ORDER, ...OPACITY_KEYS.map((o) => o.command), Command.CopyProperties, Command.PasteProperties, Command.PasteReplace, Command.TidyUp, Command.ToggleHidden, Command.ToggleLocked, Command.SelectMatching, Command.SelectAll]);

export function frameKeyAction(e: KeyboardEvent): ActionId | null {
  const command = commandFor({ key: e.key, code: e.code, mod: e.metaKey || e.ctrlKey, shift: e.shiftKey, alt: e.altKey }, EditMode.Design);
  return command && FRAME_KEYS.has(command) ? command : null;
}
