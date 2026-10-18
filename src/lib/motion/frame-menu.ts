import { ALIGN_ACTIONS, ALIGN_EDGE, type SelectionActionId } from '$lib/canvas/selection-actions';
import { FrameKind } from '$lib/canvas/motion-node';
import { compOf, findClip, type MotionDoc } from './doc';
import { elementName } from './element-name';
import { Command } from './shortcuts';
import type { Edge } from './space';

const FRAME_COMMAND: Partial<Record<SelectionActionId, Command>> = {
  group: Command.Group,
  ungroup: Command.Ungroup,
  duplicate: Command.Duplicate,
  'use-as-mask': Command.UseAsMask,
  'release-mask': Command.RemoveMask,
  delete: Command.Delete
};

export type FrameMenuRun = { command: Command } | { edge: Edge };

export const FRAME_MENU_IDS: ReadonlySet<SelectionActionId> = new Set([...(Object.keys(FRAME_COMMAND) as SelectionActionId[]), ...ALIGN_ACTIONS]);

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
    return { id, type: 'clip', data: clip && compOf(clip) ? { kind: FrameKind.Group } : {} };
  });
}
