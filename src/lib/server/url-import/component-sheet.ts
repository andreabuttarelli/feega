import type { MotionClip, MotionComp, MotionDoc } from '@feega/motion-core/motion/doc';
import type { PlanItem } from '$lib/canvas/figma/figma-doc';
import { placeInstance } from '$lib/motion/canvas-components';
import type { NewId } from '$lib/motion/main-component';

export const SHEET_NAME = 'Components';

const MARGIN_PX = 80;
const GAP_PX = 48;
const BESIDE_PX = 240;
const BACKGROUND = /\/Background$/;

type Box = { left: number; top: number; right: number; bottom: number };

function boxOf(comp: MotionComp): Box | null {
  const boxes = comp.tracks
    .flatMap((t) => t.clips as MotionClip[])
    .filter((c) => !c.parent && Number(c.props.width) > 0 && Number(c.props.height) > 0)
    .map((c) => {
      const [x, y, w, h] = [c.props.x, c.props.y, c.props.width, c.props.height].map(Number);
      const [dx, dy] = [Number(c.transform?.x ?? 0), Number(c.transform?.y ?? 0)];
      return { left: x - w / 2 + dx, top: y - h / 2 + dy, right: x + w / 2 + dx, bottom: y + h / 2 + dy };
    });
  if (!boxes.length) {
    return null;
  }
  return { left: Math.min(...boxes.map((b) => b.left)), top: Math.min(...boxes.map((b) => b.top)), right: Math.max(...boxes.map((b) => b.right)), bottom: Math.max(...boxes.map((b) => b.bottom)) };
}

type Main = { id: string; set: string; box: Box };

function mainsOf(doc: MotionDoc): Main[] {
  return Object.entries(doc.comps).flatMap(([id, comp]) => {
    const box = comp.component ? boxOf(comp) : null;
    return box ? [{ id, set: comp.component!.set ?? id, box }] : [];
  });
}

function rowsOf(mains: Main[]): Main[][] {
  const rows = new Map<string, Main[]>();
  mains.forEach((m) => rows.set(m.set, [...(rows.get(m.set) ?? []), m]));
  return [...rows.values()];
}

function insideComps(doc: MotionDoc): Set<string> {
  return new Set(Object.values(doc.comps).flatMap((c) => c.tracks.flatMap((t) => t.clips.map((clip) => clip.id))));
}

const areaOf = (c: MotionClip) => Number(c.props.width ?? 0) * Number(c.props.height ?? 0);

function backdropped(source: MotionDoc): MotionDoc['tracks'] {
  const painted = source.tracks.flatMap((t) => (t.clips as MotionClip[]).filter((c) => c.component === 'Shape' && BACKGROUND.test(c.bind?.fill ?? '')).map((clip) => ({ track: t.id, clip })));
  const backdrop = painted.sort((a, b) => areaOf(b.clip) - areaOf(a.clip))[0];
  return source.tracks.map((t) => ({ ...t, clips: backdrop?.track === t.id ? [{ ...backdrop.clip, parent: null }] : [] }));
}

export function componentSheet(item: PlanItem, newId: NewId): PlanItem | null {
  const source = item.doc;
  const mains = mainsOf(source);
  if (!mains.length) {
    return null;
  }
  const [mx, my, gx, gy] = [MARGIN_PX / source.width, MARGIN_PX / source.height, GAP_PX / source.width, GAP_PX / source.height];
  let doc: MotionDoc = { ...source, tracks: backdropped(source), comps: {} };
  let top = my;
  for (const row of rowsOf(mains)) {
    let left = mx;
    for (const main of row) {
      const placed = placeInstance(doc, source, main.id, newId, { x: left - main.box.left, y: top - main.box.top });
      doc = placed.ok ? placed.doc : doc;
      left += main.box.right - main.box.left + gx;
    }
    top += Math.max(...row.map((m) => m.box.bottom - m.box.top)) + gy;
  }
  const inside = insideComps(doc);
  return { ...item, doc, name: SHEET_NAME, centre: { x: item.centre.x + item.size.width + BESIDE_PX, y: item.centre.y }, images: item.images.filter((i) => inside.has(i.clipId)) };
}
