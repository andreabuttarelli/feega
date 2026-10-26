import { composeHtml } from '@feega/motion-core/motion/hyperframes/compose';
import { leafRectsAt, pickOwnersAt, pickStackAt, quadOf, rectOf } from '$lib/motion/gpu/pick';
import { findClip } from '@feega/motion-core/motion/doc';
import { compileScene, type Scene } from '$lib/motion/gpu/scene';
import { frameOfLive } from '$lib/canvas/core/frame-source';
import type { LiveDoc } from '$lib/canvas/core/live-docs.svelte';
import { containFit } from './frame-hover';
import type { Box } from './core/canvas-scene';
import { scopeOf } from './frame-scope';

type Size = { width: number; height: number };
type World = { x: number; y: number };
export type WorldRect = { x: number; y: number; w: number; h: number };
export type FrameSpace = { toFrame(world: World): [number, number]; toWorld(rect: { left: number; top: number; width: number; height: number }): WorldRect; pointToWorld(p: [number, number]): World };

const ORIGIN = 'https://app.local';

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

export function framePicker(live: LiveDoc, playhead: () => number | undefined = () => live.playhead) {
  let compiled: Scene | null = null;
  const scene = () => (compiled ??= compileScene(composeHtml({ doc: live.doc, tokens: live.tokens, assets: live.assets, origin: ORIGIN })));
  const time = () => frameOfLive({ doc: live.doc, playhead: playhead() }) / live.doc.fps;
  const ownersAt = (world: World, space: FrameSpace): string[] => {
    const s = scene();
    const [x, y] = space.toFrame(world);
    if (x < 0 || y < 0 || x > s.width || y > s.height) {
      return [];
    }
    return pickOwnersAt(s, [x, y], time());
  };
  return {
    spaceOf(box: Box, rotation: number, fit = FrameFit.Contain): FrameSpace {
      const s = scene();
      return frameSpace(box, { width: s.width, height: s.height }, rotation, fit);
    },
    pick(world: World, space: FrameSpace): string | null {
      return ownersAt(world, space).findLast((id) => findClip(live.doc, id)) ?? null;
    },
    stack(world: World, space: FrameSpace): string[] {
      const s = scene();
      const [x, y] = space.toFrame(world);
      return x < 0 || y < 0 || x > s.width || y > s.height ? [] : pickStackAt(s, [x, y], time()).filter((id) => findClip(live.doc, id));
    },
    chain(world: World, space: FrameSpace): string[] {
      return ownersAt(world, space).filter((id) => scopeOf(live.doc, id));
    },
    unitAt(world: World, space: FrameSpace): World {
      const s = scene();
      const [x, y] = space.toFrame(world);
      return { x: x / s.width, y: y / s.height };
    },
    frameSize(): Size {
      const s = scene();
      return { width: s.width, height: s.height };
    },
    leafRects() {
      return leafRectsAt(scene(), time());
    },
    frameRect(clip: string) {
      return rectOf(scene(), clip, time());
    },
    framePoint(world: World, space: FrameSpace): [number, number] {
      return space.toFrame(world);
    },
    outlineQuad(clip: string, space: FrameSpace): [World, World, World, World] | null {
      const q = quadOf(scene(), clip, time());
      return q ? (q.map((p) => space.pointToWorld(p)) as [World, World, World, World]) : null;
    },
    outline(clip: string, space: FrameSpace): WorldRect | null {
      const r = rectOf(scene(), clip, time());
      return r ? space.toWorld(r) : null;
    }
  };
}
