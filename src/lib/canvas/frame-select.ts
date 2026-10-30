import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { Depth, drill, type Gesture, type Level, type Probe } from '$lib/motion/drill';
import { EditMode } from '$lib/motion/edit-mode';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { PART_SEP } from '@feega/motion-core/motion/poster-parts';
import { isLayer } from '@feega/motion-core/motion/surface';
import { TrackKind } from '@feega/motion-core/motion/components';
import type { VideoSide } from './layers-source.svelte';
import type { ActionId } from '$lib/motion/actions';

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
  run: (id: ActionId) => void;
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
    run: hooks.run,
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

const FULL_FRAME = { x: 0.5, y: 0.5, width: 1, height: 1 };
const SPAN_TOLERANCE = 1e-3;

const spansFrame = (clip: MotionClip): boolean => Object.entries(FULL_FRAME).every(([key, full]) => Math.abs(Number(clip.props[key]) - full) <= SPAN_TOLERANCE);

export function framePage(doc: MotionDoc): string | null {
  const clips = doc.tracks.filter((t) => t.kind === TrackKind.Visual).flatMap((t) => t.clips as MotionClip[]);
  const roots = clips.filter((c) => !c.parent && isLayer(doc, c.id));
  const [only] = roots;
  return roots.length === 1 && spansFrame(only) && clips.some((c) => c.parent === only.id) ? only.id : null;
}

function samePlaceOrTop(doc: MotionDoc, hit: string, picks: readonly string[]): string | null {
  const page = framePage(doc);
  const chain = ancestry(doc, hit).filter((id) => id !== page);
  const level = picks.length ? parentOf(doc, picks[0]) : null;
  return chain.find((id) => picks.length && parentOf(doc, id) === level) ?? chain.at(-1) ?? null;
}

export function childBelow(doc: MotionDoc, hit: string, picks: readonly string[]): string | null {
  const [picked] = picks;
  return picks.length === 1 ? (ancestry(doc, hit).find((id) => parentOf(doc, id) === picked) ?? null) : null;
}

const REACH: Record<Reach, (doc: MotionDoc, hit: string, picks: readonly string[]) => string | null> = {
  [Reach.Top]: samePlaceOrTop,
  [Reach.Deep]: (_doc, hit) => hit
};

export const clickTarget = (doc: MotionDoc, hit: string, picks: readonly string[], reach: Reach): string | null => REACH[reach](doc, hit, picks);

export function siblingsOf(doc: MotionDoc, picks: readonly string[]): string[] {
  const level = picks.length ? parentOf(doc, picks[0]) : null;
  return doc.tracks.flatMap((t) => (t.clips as MotionClip[]).filter((c) => (c.parent ?? null) === level).map((c) => c.id));
}

export const grabbedInstead = (picks: readonly string[], under: string | null): string | null => (picks.length === 1 && under && under !== picks[0] ? under : null);
