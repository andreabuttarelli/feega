import { findClip, type MotionClip, type MotionDoc } from '$lib/motion/doc';
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

export enum Reach {
  Top = 'top',
  Deep = 'deep'
}

const parentOf = (doc: MotionDoc, id: string) => findClip(doc, id)?.clip.parent ?? null;

function ancestry(doc: MotionDoc, id: string): string[] {
  const chain = [id];
  for (let up = parentOf(doc, id); up && !chain.includes(up); up = parentOf(doc, up)) {
    chain.push(up);
  }
  return chain;
}

function samePlaceOrTop(doc: MotionDoc, hit: string, picks: readonly string[]): string {
  const chain = ancestry(doc, hit);
  const level = picks.length ? parentOf(doc, picks[0]) : null;
  return chain.find((id) => picks.length && parentOf(doc, id) === level) ?? chain[chain.length - 1];
}

const REACH: Record<Reach, (doc: MotionDoc, hit: string, picks: readonly string[]) => string> = {
  [Reach.Top]: samePlaceOrTop,
  [Reach.Deep]: (_doc, hit) => hit
};

export const clickTarget = (doc: MotionDoc, hit: string, picks: readonly string[], reach: Reach): string => REACH[reach](doc, hit, picks);

export function siblingsOf(doc: MotionDoc, picks: readonly string[]): string[] {
  const level = picks.length ? parentOf(doc, picks[0]) : null;
  return doc.tracks.flatMap((t) => (t.clips as MotionClip[]).filter((c) => (c.parent ?? null) === level).map((c) => c.id));
}
