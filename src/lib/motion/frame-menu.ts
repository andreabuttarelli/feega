import { ALIGN_ACTIONS, ALIGN_EDGE, type SelectionActionId } from '$lib/canvas/selection-actions';
import { DocNodeType, FrameKind } from '$lib/canvas/motion-node';
import { compOf, findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { elementName } from './element-name';
import { Command } from './shortcuts';
import type { Edge } from './space';

const FRAME_COMMAND: Partial<Record<SelectionActionId, Command>> = {
  group: Command.Group,
  ungroup: Command.Ungroup,
  duplicate: Command.Duplicate,
  'bring-front': Command.BringToFront,
  'send-back': Command.SendToBack,
  'tidy-up': Command.TidyUp,
  'flip-horizontal': Command.FlipHorizontal,
  'flip-vertical': Command.FlipVertical,
  'create-component': Command.CreateComponent,
  'detach-instance': Command.DetachInstance,
  'go-to-main': Command.GoToMain,
  'reset-instance': Command.ResetInstance,
  'push-instance': Command.PushInstance,
  hide: Command.ToggleHidden,
  lock: Command.ToggleLocked,
  'copy-properties': Command.CopyProperties,
  'paste-properties': Command.PasteProperties,
  'use-as-mask': Command.UseAsMask,
  'release-mask': Command.RemoveMask,
  'select-matching': Command.SelectMatching,
  'select-same-fill': Command.SelectSameFill,
  'select-same-stroke': Command.SelectSameStroke,
  'select-same-font': Command.SelectSameFont,
  'select-same-effect': Command.SelectSameEffect,
  'frame-selection': Command.FrameSelection,
  'resize-to-fit': Command.ResizeToFit,
  'auto-layout': Command.AutoLayout,
  'union': Command.Union,
  'subtract': Command.Subtract,
  'intersect': Command.Intersect,
  'exclude': Command.Exclude,
  'flatten': Command.Flatten,
  'outline-stroke': Command.OutlineStroke,
  'outline-text': Command.TextToPath,
  delete: Command.Delete
};

export type FrameMenuRun = { command: Command } | { edge: Edge };

export const FRAME_MENU_IDS: ReadonlySet<SelectionActionId> = new Set([
  ...(Object.keys(FRAME_COMMAND) as SelectionActionId[]),
  ...ALIGN_ACTIONS
]);

export function frameMenuRun(id: SelectionActionId): FrameMenuRun | null {
  const command = FRAME_COMMAND[id];
  if (command) {
    return { command };
  }
  const edge = (ALIGN_EDGE as Partial<Record<SelectionActionId, Edge>>)[id];
  return edge ? { edge } : null;
}

export type FrameLayer = { id: string; label: string };

export function frameLayers(doc: MotionDoc, ids: readonly string[]): FrameLayer[] {
  return ids.flatMap((id) => {
    const clip = findClip(doc, id)?.clip;
    if (!clip) {
      return [];
    }
    const comp = compOf(clip);
    return [{ id, label: (comp && doc.comps[comp]?.name) || elementName(clip) }];
  });
}

export function frameSummaries(doc: MotionDoc, ids: readonly string[]) {
  return ids.map((id) => {
    const clip = findClip(doc, id)?.clip;
    return clip && compOf(clip) ? { id, type: DocNodeType.Element, data: { kind: FrameKind.Group } } : { id, type: 'clip', data: {} };
  });
}
