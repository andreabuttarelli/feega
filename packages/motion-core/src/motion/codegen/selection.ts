import { compsOf, type MotionClip, type MotionDoc, type MotionTrack } from '../doc';
import type { Box } from '../layout';
import { shownBox, withAutoLayout } from '../layout/resolve';
import { ancestorsOf, apply2d, IDENTITY, pivotBox, worldAt, type Affine, type Size } from '../parent';
import { TrackKind } from '../components';

const FIRST_FRAME = 0;
const MIN_SIDE_PX = 1;

const visualClips = (doc: MotionDoc): MotionClip[] => doc.tracks.filter((t) => t.kind === TrackKind.Visual).flatMap((t) => t.clips as MotionClip[]);

function bounds(boxes: Box[]): Box {
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.left + b.width));
  const bottom = Math.max(...boxes.map((b) => b.top + b.height));
  return { left, top, width: right - left, height: bottom - top };
}

function transformed(box: Box, world: Affine): Box {
  const corners = [
    [box.left, box.top],
    [box.left + box.width, box.top],
    [box.left, box.top + box.height],
    [box.left + box.width, box.top + box.height]
  ].map(([x, y]) => apply2d(world, [x, y]));
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

function worldBox(laid: MotionDoc, clip: MotionClip, size: Size): Box | null {
  if (clip.component === 'Precomp') {
    const box = shownBox(laid, clip.id);
    const parent = clip.parent ? worldAt(laid, clip.parent, FIRST_FRAME, size) : IDENTITY;
    return box && transformed(box, parent);
  }
  return transformed(pivotBox(clip.props, size), worldAt(laid, clip.id, FIRST_FRAME, size));
}

function topmost(laid: MotionDoc, ids: readonly string[]): MotionClip[] {
  const picked = new Set(ids);
  return visualClips(laid).filter((c) => picked.has(c.id) && !ancestorsOf(laid, c.id).some((a) => picked.has(a)));
}

function withBelow(clips: MotionClip[], roots: MotionClip[]): MotionClip[] {
  const kept = new Set(roots.map((r) => r.id));
  const grown = () => clips.filter((c) => !kept.has(c.id) && c.parent && kept.has(c.parent));
  for (let next = grown(); next.length; next = grown()) {
    next.forEach((c) => kept.add(c.id));
  }
  return clips.filter((c) => kept.has(c.id));
}

type Scale = { x: number; y: number; unit: number };

function scaledProps(props: Record<string, unknown>, scale: Scale): Record<string, unknown> {
  const out = { ...props };
  const by = (key: string, factor: number) => typeof out[key] === 'number' && (out[key] = (out[key] as number) * factor);
  by('x', scale.x);
  by('width', scale.x);
  by('y', scale.y);
  by('height', scale.y);
  by('size', scale.unit);
  if (Array.isArray(out.strokes)) {
    out.strokes = out.strokes.map((s: { width?: number }) => (typeof s.width === 'number' ? { ...s, width: s.width * scale.unit } : s));
  }
  return out;
}

function rescaled(clip: MotionClip, scale: Scale): MotionClip {
  const transform = { ...clip.transform };
  if (typeof transform.x === 'number') {
    transform.x *= scale.x;
  }
  if (typeof transform.y === 'number') {
    transform.y *= scale.y;
  }
  return { ...clip, props: scaledProps(clip.props, scale), transform };
}

function placed(clip: MotionClip, box: Box, origin: Box, size: Size): MotionClip {
  const left = box.left - origin.left;
  const top = box.top - origin.top;
  if (clip.component === 'Precomp') {
    return { ...clip, parent: null, transform: { x: left / size.width, y: top / size.height } };
  }
  const props = { ...clip.props, x: (left + box.width / 2) / size.width, y: (top + box.height / 2) / size.height, width: box.width / size.width, height: box.height / size.height };
  return { ...clip, parent: null, props, transform: {} };
}

const unitOf = (size: Size) => Math.min(size.width, size.height);

function usedComps(doc: MotionDoc, clips: MotionClip[]): MotionDoc['comps'] {
  const used = new Set<string>();
  const visit = (list: MotionClip[]) =>
    list.flatMap(compsOf).forEach((id) => {
      if (used.has(id) || !doc.comps[id]) {
        return;
      }
      used.add(id);
      visit(doc.comps[id].tracks.flatMap((t) => t.clips as MotionClip[]));
    });
  visit(clips);
  return Object.fromEntries(Object.entries(doc.comps).filter(([id]) => used.has(id)));
}

function usedAssets(doc: MotionDoc, clips: MotionClip[], comps: MotionDoc['comps']): MotionDoc['assets'] {
  const text = JSON.stringify([clips, comps]);
  return doc.assets.filter((a) => text.includes(a.id));
}

export function selectionDoc(doc: MotionDoc, ids: readonly string[]): MotionDoc {
  const laid = withAutoLayout(doc);
  const roots = topmost(laid, ids);
  const size = { width: doc.width, height: doc.height };
  const boxes = roots.map((r) => worldBox(laid, r, size));
  if (!roots.length || boxes.some((b) => !b)) {
    return doc;
  }

  const origin = bounds(boxes as Box[]);
  const next = { width: Math.max(MIN_SIDE_PX, Math.round(origin.width)), height: Math.max(MIN_SIDE_PX, Math.round(origin.height)) };
  const scale = { x: size.width / next.width, y: size.height / next.height, unit: unitOf(size) / unitOf(next) };
  const rootAt = new Map(roots.map((r, i) => [r.id, boxes[i] as Box]));
  const clips = withBelow(visualClips(laid), roots).map((c) => (rootAt.has(c.id) ? rescaledRoot(c, rootAt.get(c.id)!, origin, next, scale) : rescaled(c, scale)));
  const comps = usedComps(doc, clips);
  const kept = new Set(clips.map((c) => c.id));
  const tracks = doc.tracks.map((t): MotionTrack => ({ ...t, clips: (t.clips as MotionClip[]).flatMap((c) => (kept.has(c.id) ? [clips.find((k) => k.id === c.id)!] : [])) as MotionTrack['clips'] })).filter((t) => t.clips.length || t.kind !== TrackKind.Visual);
  return { ...doc, ...next, tracks, comps, assets: usedAssets(doc, clips, comps), breakpoints: undefined, surface: undefined };
}

function rescaledRoot(clip: MotionClip, box: Box, origin: Box, next: Size, scale: Scale): MotionClip {
  const own = placed(clip, box, origin, next);
  return { ...own, props: clip.component === 'Precomp' ? own.props : scaledProps(own.props, { x: 1, y: 1, unit: scale.unit }) };
}

const SELECTION_SUFFIX = 'Selection';

export type Selected = { doc: MotionDoc; name: string; label: string | null };

export function selected(doc: MotionDoc, ids: readonly string[], frameName: string): Selected {
  const picked = selectionDoc(doc, ids);
  if (picked === doc) {
    return { doc, name: frameName, label: null };
  }
  const roots = topmost(withAutoLayout(doc), ids);
  const name = roots.length === 1 ? roots[0].name || roots[0].id : `${frameName} ${SELECTION_SUFFIX}`;
  return { doc: picked, name, label: name };
}
