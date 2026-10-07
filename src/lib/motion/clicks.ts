import type { MotionClip, MotionDoc } from './doc';
import { apply2d, type Affine } from './affine';
import { pivotBox, worldAt, type Size } from './parent';
import { Space, cameraMath, newCamera, baseValues } from './camera';
import { sampleTrack } from './sample-track';
import { pieceAnchors, stageScale, type Rect } from './ui-kit/anchors';
import { cursorPlan } from './ui-kit/cursor-plan';
import { springMath } from './spring';
import { reelMath } from './ui-morph/reel';
import { isReel, reelPlanOf } from './ui-morph/ops';

export const CURSOR_PIECE = 'UiCursor';
export const TARGET_SEPARATOR = '#';

export type Point = [number, number];
export type Box = { left: number; top: number; width: number; height: number };
type Tracks = MotionDoc['tracks'];
type Place = { clip: MotionClip; tracks: Tracks; size: Size; hosts: MotionClip[] };

const camera = cameraMath(sampleTrack);
const reel = reelMath(springMath());

const containers = (doc: MotionDoc) => [{ name: null as string | null, tracks: doc.tracks, size: { width: doc.width, height: doc.height } }, ...Object.entries(doc.comps).map(([name, c]) => ({ name, tracks: c.tracks, size: c.frame ?? { width: doc.width, height: doc.height } }))];

function hostOf(doc: MotionDoc, comp: string): MotionClip | null {
  for (const { tracks } of containers(doc)) {
    const host = tracks.flatMap((t) => t.clips as MotionClip[]).find((c) => c.component === 'Precomp' && c.props.comp === comp);
    if (host) {
      return host;
    }
  }
  return null;
}

function compOf(doc: MotionDoc, clip: MotionClip): string | null {
  return Object.entries(doc.comps).find(([, c]) => c.tracks.some((t) => t.clips.some((k) => k.id === clip.id)))?.[0] ?? null;
}

export function placeOf(doc: MotionDoc, clipId: string): Place | null {
  for (const container of containers(doc)) {
    const clip = container.tracks.flatMap((t) => t.clips as MotionClip[]).find((c) => c.id === clipId);
    if (!clip) {
      continue;
    }
    const hosts: MotionClip[] = [];
    for (let comp = container.name; comp; ) {
      const host = hostOf(doc, comp);
      if (!host || hosts.includes(host)) {
        break;
      }
      hosts.push(host);
      comp = compOf(doc, host);
    }
    return { clip, tracks: container.tracks, size: container.size, hosts };
  }
  return null;
}

export function startOf(place: Place): number {
  return place.clip.from + place.hosts.reduce((sum, h) => sum + h.from, 0);
}

function project(doc: MotionDoc, [x, y]: Point, depth: number, frame: number): Point {
  const cam = doc.camera ?? newCamera();
  const spec = { width: doc.width, height: doc.height, rest: camera.perspectiveOf(baseValues(cam).fov, doc.height), dof: false, base: baseValues(cam), keyframes: cam.keyframes, layers: [] };
  const v = camera.valuesAt(spec, frame);
  const m = camera.worldMatrix(v, spec);
  const c = camera.compensation(spec, depth);
  const p = [(x - doc.width / 2) * c, (y - doc.height / 2) * c, -depth, 1];
  const q = [0, 1, 2].map((r) => p.reduce((sum, value, k) => sum + m[k * 4 + r] * value, 0));
  const perspective = camera.perspectiveOf(v.fov, doc.height);
  const w = perspective / (perspective - q[2]);
  return [doc.width / 2 + q[0] * w, doc.height / 2 + q[1] * w];
}

export function toScreen(doc: MotionDoc, place: Place, local: Point, frame: number): Point {
  let point = local;
  let tracks = place.tracks;
  let size = place.size;
  let clip = place.clip;
  let time = frame - place.hosts.reduce((sum, h) => sum + h.from, 0);
  for (const host of [...place.hosts, null]) {
    point = apply2d(worldAt({ tracks }, clip.id, time, size) as Affine, point);
    if (!host) {
      break;
    }
    time += host.from;
    const outer = placeOf(doc, host.id);
    if (!outer) {
      break;
    }
    const box = pivotBox(host.props, outer.size);
    point = [box.left + (point[0] / size.width) * box.width, box.top + (point[1] / size.height) * box.height];
    tracks = outer.tracks;
    size = outer.size;
    clip = host;
  }
  const top = place.hosts.at(-1) ?? place.clip;
  return top.space === Space.Screen ? point : project(doc, point, top.depth, frame);
}

const boxAround = (points: Point[]): Box => {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
};

export function anchorsOf(doc: MotionDoc, clipId: string): { place: Place; anchors: Record<string, Rect>; scale: number; origin: Point } | null {
  const place = placeOf(doc, clipId);
  if (!place || place.clip.component !== 'Custom') {
    return null;
  }
  const name = String(place.clip.props.name ?? '');
  const placed = pieceAnchors(name, place.clip.props, doc.components[name]?.source.js);
  if (!placed) {
    return null;
  }
  const box = pivotBox(place.clip.props, place.size);
  const zoom = typeof place.clip.props.zoom === 'number' ? place.clip.props.zoom : 1;
  return { place, anchors: placed.anchors, scale: stageScale(placed.size, box, zoom), origin: [box.left + box.width / 2, box.top + box.height / 2] };
}

export function anchorBox(doc: MotionDoc, clipId: string, anchor: string, frame: number): Box | null {
  const found = anchorsOf(doc, clipId);
  const rect = found?.anchors[anchor];
  if (!found || !rect) {
    return null;
  }
  const { origin, scale, place } = found;
  const corners: Point[] = [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y],
    [rect.x, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h]
  ].map(([x, y]) => toScreen(doc, place, [origin[0] + x * scale, origin[1] + y * scale], frame));
  return boxAround(corners);
}

const on = (clip: MotionClip, start: number, frame: number) => frame >= start && frame < start + clip.durationInFrames;

export type Clickable = { clipId: string; anchor: string; box: Box };

export function clickablesAt(doc: MotionDoc, frame: number): Clickable[] {
  return containers(doc).flatMap(({ tracks }) =>
    tracks.flatMap((t) => (t.clips as MotionClip[]).flatMap((clip) => {
      const found = anchorsOf(doc, clip.id);
      if (!found || !on(clip, startOf(found.place), frame)) {
        return [];
      }
      return Object.keys(found.anchors).flatMap((anchor) => {
        const box = anchorBox(doc, clip.id, anchor, frame);
        return box ? [{ clipId: clip.id, anchor, box }] : [];
      });
    }))
  );
}

export type Click = { clipId: string; frame: number; point: Point; target: string | null };

export function cursorClicks(doc: MotionDoc): Click[] {
  return containers(doc).flatMap(({ tracks }) =>
    tracks.flatMap((t) => (t.clips as MotionClip[]).filter((c) => c.component === 'Custom' && c.props.name === CURSOR_PIECE).flatMap((clip) => {
      const place = placeOf(doc, clip.id);
      if (!place) {
        return [];
      }
      const box = pivotBox(clip.props, place.size);
      const plan = cursorPlan(String(clip.props.path ?? ''), clip.durationInFrames / doc.fps);
      return plan.clicks.map((c) => {
        const frame = Math.round(startOf(place) + c.at * doc.fps);
        return { clipId: clip.id, frame, target: c.target, point: toScreen(doc, place, [box.left + c.x * box.width, box.top + c.y * box.height], frame) };
      });
    }))
  );
}

const inside = ([x, y]: Point, b: Box) => x >= b.left && x <= b.left + b.width && y >= b.top && y <= b.top + b.height;

export type Miss = { clipId: string; frame: number; detail: string };

const near = (point: Point, list: Clickable[]) => list.slice().sort((a, b) => distance(point, a.box) - distance(point, b.box))[0];

const distance = ([x, y]: Point, b: Box) => Math.hypot(Math.max(b.left - x, 0, x - b.left - b.width), Math.max(b.top - y, 0, y - b.top - b.height));

export function cursorMisses(doc: MotionDoc): Miss[] {
  return cursorClicks(doc).flatMap((click) => {
    const all = clickablesAt(doc, click.frame);
    const targets = click.target ? all.filter((t) => `${t.clipId}${TARGET_SEPARATOR}${t.anchor}` === click.target) : all;
    if (targets.some((t) => inside(click.point, t.box))) {
      return [];
    }
    const closest = near(click.point, targets);
    const at = `${Math.round(click.point[0])},${Math.round(click.point[1])} px`;
    const hint = closest ? `; ${closest.anchor} of ${closest.clipId} is ${Math.round(distance(click.point, closest.box))} px away: click_ui with that anchor` : ': no clickable UI is on screen then';
    const aimed = click.target ? `outside its target ${click.target}` : 'on nothing clickable';
    return [{ clipId: click.clipId, frame: click.frame, detail: `${click.clipId} clicks at ${at} at ${(click.frame / doc.fps).toFixed(2)} s ${aimed}${hint}` }];
  });
}

const REEL_SAMPLE = 0.02;
const SETTLED = 0.75;

const outside = (v: Record<string, number>) => Math.abs(v.curX) > v.w / 2 || Math.abs(v.curY) > v.h / 2;

export function reelMisses(doc: MotionDoc): Miss[] {
  return containers(doc).flatMap(({ tracks }) =>
    tracks.flatMap((t) => (t.clips as MotionClip[]).filter(isReel).flatMap((clip) => {
      const plan = reelPlanOf(doc, clip.props);
      const presses = plan.sounds.filter((s) => s.kind === 'press').map((s) => ({ at: s.at + REEL_SAMPLE, verb: 'presses' }));
      const dragging = (t: number) => plan.drags.some((d) => t >= d.press && t <= d.release + plan.step);
      const rests = plan.cues.map((c) => ({ at: c + plan.step * SETTLED, verb: 'rests' })).filter((r) => !dragging(r.at));
      return [...presses, ...rests].flatMap(({ at, verb }) => {
        const v = reel.frameAt(plan, at).values;
        if (!outside(v)) {
          return [];
        }
        return [{ clipId: clip.id, frame: clip.from + Math.round(at * doc.fps), detail: `the reel cursor ${verb} at ${Math.round(v.curX)},${Math.round(v.curY)} outside the ${Math.round(v.w)}×${Math.round(v.h)} UI at ${at.toFixed(2)} s` }];
      });
    }))
  );
}
