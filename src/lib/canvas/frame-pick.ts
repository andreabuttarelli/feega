import { prepare, type Prepared } from '@feega/motion-core/motion/gpu-full/display-list';
import { NO_TYPESET, type Smoothing, type Typeset } from '@feega/motion-core/motion/gpu-full/text/painter';
import { loadFonts } from '@feega/motion-core/motion/gpu-full/text/load';
import { shapedText } from '@feega/motion-core/motion/gpu-full/text/measure';
import type { TextMeasure } from '@feega/motion-core/motion/layout/text-extent';
import { isLayer } from '@feega/motion-core/motion/surface';
import { frameOfLive } from '$lib/canvas/core/frame-source';
import { FramePlacements, type FrameRect } from './frame-placements';
import type { LiveDoc } from '$lib/canvas/core/live-docs.svelte';
import { containFit } from './frame-hover';
import type { Box } from './core/canvas-scene';
import { scopeOf } from './frame-scope';

type Size = { width: number; height: number };
type World = { x: number; y: number };
export type WorldRect = { x: number; y: number; w: number; h: number };
export type FrameSpace = { toFrame(world: World): [number, number]; toWorld(rect: { left: number; top: number; width: number; height: number }): WorldRect; pointToWorld(p: [number, number]): World };

function turn(p: World, about: World, degrees: number): World {
  const r = (degrees * Math.PI) / 180;
  const dx = p.x - about.x;
  const dy = p.y - about.y;
  return { x: about.x + dx * Math.cos(r) - dy * Math.sin(r), y: about.y + dx * Math.sin(r) + dy * Math.cos(r) };
}

export enum FrameFit {
  Contain = 'contain',
  Stretch = 'stretch'
}

function fitted(box: Box, frame: Size, fit: FrameFit) {
  if (fit === FrameFit.Stretch) {
    return { left: 0, top: 0, sx: box.w / frame.width, sy: box.h / frame.height };
  }
  const contained = containFit({ width: box.w, height: box.h }, frame);
  const scale = contained.width / frame.width;
  return { left: contained.left, top: contained.top, sx: scale, sy: scale };
}

export function frameSpace(box: Box, frame: Size, rotation: number, fit = FrameFit.Contain): FrameSpace {
  const { left, top, sx, sy } = fitted(box, frame, fit);
  const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  return {
    toFrame(world) {
      const local = turn(world, centre, -rotation);
      return [(local.x - box.x - left) / sx, (local.y - box.y - top) / sy];
    },
    toWorld(r) {
      return { x: box.x + left + r.left * sx, y: box.y + top + r.top * sy, w: r.width * sx, h: r.height * sy };
    },
    pointToWorld([x, y]) {
      return { x: box.x + left + x * sx, y: box.y + top + y * sy };
    }
  };
}

const covers = (r: FrameRect | null, x: number, y: number): boolean => Boolean(r && x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height);

export type Typesetter = (live: LiveDoc) => Promise<Typeset>;

export const estimated: Typesetter = async () => NO_TYPESET;

export const shaped =
  (smoothing: Smoothing): Typesetter =>
  async (live) => ({ fonts: await loadFonts(live.doc, live.assets, live.tokens), smoothing });

export function framePicker(live: LiveDoc, playhead: () => number | undefined = () => live.playhead, typesetter: Typesetter = estimated, onTypeset: () => void = () => {}) {
  let typeset = NO_TYPESET;
  let prepared: Prepared | null = null;
  let shown: { frame: number; placements: FramePlacements } | null = null;
  typesetter(live)
    .then((loaded) => {
      typeset = loaded;
      prepared = null;
      shown = null;
      onTypeset();
    })
    .catch(() => undefined);
  const size = (): Size => ({ width: live.doc.width, height: live.doc.height });
  const placements = (): FramePlacements => {
    const frame = frameOfLive({ doc: live.doc, playhead: playhead() });
    if (shown?.frame !== frame) {
      prepared ??= prepare(live.doc, live.tokens, live.assets, typeset);
      shown = { frame, placements: new FramePlacements(prepared, frame) };
    }
    return shown!.placements;
  };
  const inFrame = ([x, y]: [number, number]) => x >= 0 && y >= 0 && x <= live.doc.width && y <= live.doc.height;
  const ownersAt = (world: World, space: FrameSpace): string[] => {
    const at = space.toFrame(world);
    return inFrame(at) ? placements().ownersAt(at) : [];
  };
  return {
    spaceOf(box: Box, rotation: number, fit = FrameFit.Contain): FrameSpace {
      return frameSpace(box, size(), rotation, fit);
    },
    pick(world: World, space: FrameSpace): string | null {
      return ownersAt(world, space).findLast((id) => isLayer(live.doc, id)) ?? null;
    },
    pickHeld(world: World, space: FrameSpace, held: readonly string[]): string | null {
      const hit = ownersAt(world, space).findLast((id) => isLayer(live.doc, id));
      if (hit) {
        return hit;
      }
      const [x, y] = space.toFrame(world);
      return held.find((id) => covers(placements().rectOf(id), x, y)) ?? null;
    },
    stack(world: World, space: FrameSpace): string[] {
      const at = space.toFrame(world);
      return inFrame(at) ? placements().stackAt(at).filter((id) => isLayer(live.doc, id)) : [];
    },
    chain(world: World, space: FrameSpace): string[] {
      return ownersAt(world, space).filter((id) => id !== live.doc.surface && scopeOf(live.doc, id));
    },
    unitAt(world: World, space: FrameSpace): World {
      const [x, y] = space.toFrame(world);
      return { x: x / live.doc.width, y: y / live.doc.height };
    },
    frameSize(): Size {
      return size();
    },
    textMeasure(): TextMeasure {
      return shapedText(typeset);
    },
    leafRects() {
      return placements().leafRects();
    },
    frameRect(clip: string) {
      return placements().rectOf(clip);
    },
    pathRect(path: readonly string[]) {
      return placements().pathRect(path);
    },
    framePoint(world: World, space: FrameSpace): [number, number] {
      return space.toFrame(world);
    },
    outlineQuad(clip: string, space: FrameSpace): [World, World, World, World] | null {
      const q = placements().quadOf(clip);
      return q ? (q.map((p) => space.pointToWorld(p)) as [World, World, World, World]) : null;
    },
    outline(clip: string, space: FrameSpace): WorldRect | null {
      const r = placements().rectOf(clip);
      return r ? space.toWorld(r) : null;
    }
  };
}

export type FramePicker = ReturnType<typeof framePicker>;

type HeldPicker = { doc: LiveDoc['doc']; assets: LiveDoc['assets']; picker: FramePicker };

export enum Reuse {
  Changed = 'changed',
  Held = 'held'
}

export class FramePickers {
  #held = new Map<string, HeldPicker>();
  readonly #typesetter: Typesetter;
  readonly #onTypeset: () => void;

  constructor(typesetter: Typesetter = estimated, onTypeset: () => void = () => {}) {
    this.#typesetter = typesetter;
    this.#onTypeset = onTypeset;
  }

  of(id: string, live: LiveDoc, playhead: () => number | undefined = () => live.playhead, reuse = Reuse.Changed): FramePicker {
    const held = this.#held.get(id);
    if (held && (reuse === Reuse.Held || (held.doc === live.doc && held.assets === live.assets))) {
      return held.picker;
    }
    const picker = framePicker(live, playhead, this.#typesetter, this.#onTypeset);
    this.#held.set(id, { doc: live.doc, assets: live.assets, picker });
    return picker;
  }
}
