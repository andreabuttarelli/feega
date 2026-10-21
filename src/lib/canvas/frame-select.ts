import type { MotionDoc } from '$lib/motion/doc';
import { Depth, drill, type Gesture, type Level, type Probe } from '$lib/motion/drill';
import { EditMode } from '$lib/motion/edit-mode';
import type { OpResult } from '$lib/motion/timeline';
import type { VideoSide } from './layers-source.svelte';

export type Inside = { nodeId: string; level: Level };

export const frameLevel = (): Level => ({ depth: Depth.Frame, clip: null, part: null });

const probeOf = (top: string | null): Probe => ({ top, picked: top, partOf: () => null, firstClip: null, firstPart: () => null, editable: () => false });

export const stepInside = (level: Level, gesture: Gesture, top: string | null): Level => drill(level, gesture, probeOf(top)).level;

type Hooks = {
  nodeId: string;
  doc: () => MotionDoc;
  selection: () => readonly string[];
  select: (ids: string[]) => void;
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
    part: null,
    mode: EditMode.Design,
    select: hooks.select,
    selectPart: (clipId) => hooks.select([clipId]),
    edit: hooks.edit,
    preview: () => {}
  };
}
