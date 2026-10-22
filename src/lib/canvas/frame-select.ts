import type { MotionDoc } from '$lib/motion/doc';
import { Depth, drill, type Gesture, type Level, type Probe } from '$lib/motion/drill';
import { EditMode } from '$lib/motion/edit-mode';
import type { OpResult } from '$lib/motion/timeline';
import { PART_SEP } from '$lib/motion/poster-parts';
import type { VideoSide } from './layers-source.svelte';

export type Inside = { nodeId: string; level: Level };

export const frameLevel = (): Level => ({ depth: Depth.Frame, clip: null, part: null });

const probeOf = (top: string | null): Probe => ({ top, picked: top, partOf: () => null, firstClip: null, firstPart: () => null, editable: () => false });

export const stepInside = (level: Level, gesture: Gesture, top: string | null): Level => drill(level, gesture, probeOf(top)).level;

type Hooks = {
  nodeId: string;
  doc: () => MotionDoc;
  selection: () => readonly string[];
  part?: () => string | null;
  select: (ids: string[]) => void;
  selectPart?: (clipId: string, part: string) => void;
  edit: (result: OpResult, summary: string) => void;
};

export function videoSide(hooks: Hooks): VideoSide {
  return {
    nodeId: hooks.nodeId,
    get doc() {
      return hooks.doc();
    },
    get selection() {
      return hooks.selection();
    },
    parts: {},
    get part() {
      const part = hooks.part?.();
      const [clip] = hooks.selection();
      return part && clip ? `${clip}${PART_SEP}${part}` : null;
    },
    mode: EditMode.Design,
    select: hooks.select,
    selectPart: hooks.selectPart ?? ((clipId) => hooks.select([clipId])),
    edit: hooks.edit,
    preview: () => {}
  };
}

export const ownClipToPick = (alreadyPicked: string | null, node: string, own: string | null | undefined): string | null => (own && alreadyPicked !== node ? own : null);
