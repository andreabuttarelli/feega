import type { MotionClip, MotionComp, MotionDoc } from '@feega/motion-core/motion/doc';
import type { PlanItem } from '$lib/canvas/figma/figma-doc';
import { placeInstance } from '$lib/motion/canvas-components';
import { addClip, editClip } from '@feega/motion-core/motion/timeline';
import { ShapeKind } from '@feega/motion-core/motion/shape/schema';
import { DEFAULT_MODE, keyOf } from '@feega/motion-core/motion/variables-model';
import type { NewId } from '$lib/motion/main-component';

export const SHEET_NAME = 'Components';

const MARGIN_PX = 80;
const GAP_PX = 48;
const BESIDE_PX = 240;
const GRID_RATIO = 1.6;
const BACKGROUND = 'Background';

type Box = { left: number; top: number; right: number; bottom: number };

function boxOf(comp: MotionComp, frame: { width: number; height: number }): Box | null {
  const boxes = comp.tracks
    .flatMap((t) => t.clips as MotionClip[])
    .filter((c) => !c.parent && Number(c.props.width) > 0 && Number(c.props.height) > 0)
    .map((c) => {
      const [x, y, w, h] = [c.props.x, c.props.y, c.props.width, c.props.height].map(Number);
      const [dx, dy] = [Number(c.transform?.x ?? 0), Number(c.transform?.y ?? 0)];
      return { left: (x - w / 2 + dx) * frame.width, top: (y - h / 2 + dy) * frame.height, right: (x + w / 2 + dx) * frame.width, bottom: (y + h / 2 + dy) * frame.height };
    });
  if (!boxes.length) {
    return null;
  }
  return { left: Math.min(...boxes.map((b) => b.left)), top: Math.min(...boxes.map((b) => b.top)), right: Math.max(...boxes.map((b) => b.right)), bottom: Math.max(...boxes.map((b) => b.bottom)) };
}

type Main = { id: string; set: string; box: Box };

function mainsOf(doc: MotionDoc): Main[] {
  const frame = { width: doc.width, height: doc.height };
  return Object.entries(doc.comps).flatMap(([id, comp]) => {
    const box = comp.component ? boxOf(comp, frame) : null;
    return box ? [{ id, set: comp.component!.set ?? id, box }] : [];
  });
}

function rowsOf(mains: Main[]): Main[][] {
  const rows = new Map<string, Main[]>();
  mains.forEach((m) => rows.set(m.set, [...(rows.get(m.set) ?? []), m]));
  return [...rows.values()];
}

const widthOf = (m: Main) => m.box.right - m.box.left;
const heightOf = (m: Main) => m.box.bottom - m.box.top;

type Spot = { main: Main; left: number; top: number };

function gridOf(mains: Main[], room: number): Spot[] {
  const area = mains.reduce((sum, m) => sum + (widthOf(m) + GAP_PX) * (heightOf(m) + GAP_PX), 0);
  const line = Math.min(room, Math.max(...mains.map(widthOf), Math.sqrt(area * GRID_RATIO)));
  const spots: Spot[] = [];
  let [left, top, tall] = [0, 0, 0];
  const wrap = () => {
    [left, top, tall] = [0, top + tall + GAP_PX, 0];
  };
  for (const row of rowsOf(mains)) {
    const span = row.reduce((sum, m) => sum + widthOf(m) + GAP_PX, -GAP_PX);
    if (left > 0 && left + span > line) {
      wrap();
    }
    for (const main of row) {
      if (left > 0 && left + widthOf(main) > line) {
        wrap();
      }
      spots.push({ main, left, top });
      left += widthOf(main) + GAP_PX;
      tall = Math.max(tall, heightOf(main));
    }
  }
  return spots;
}

function insideComps(doc: MotionDoc): Set<string> {
  return new Set(Object.values(doc.comps).flatMap((c) => c.tracks.flatMap((t) => t.clips.map((clip) => clip.id))));
}

const FULL = { x: 0.5, y: 0.5, width: 1, height: 1 };

function backdropped(source: MotionDoc, newId: NewId): MotionDoc {
  const empty: MotionDoc = { ...source, tracks: source.tracks.map((t) => ({ ...t, clips: [] })), comps: {} };
  const [collection, vars] = Object.entries(source.variables ?? {}).find(([, c]) => c.vars[BACKGROUND]) ?? [];
  const fill = vars?.vars[BACKGROUND].values[DEFAULT_MODE];
  if (!collection || typeof fill !== 'string') {
    return empty;
  }
  const id = newId();
  const added = addClip(empty, { component: 'Shape', from: 0, durationInFrames: source.durationInFrames, props: { shape: ShapeKind.Rect, fill, ...FULL } }, id);
  const bound = added.ok ? editClip(added.doc, id, (clip) => ({ ...clip, name: BACKGROUND, bind: { fill: keyOf(collection, BACKGROUND) } })) : added;
  return bound.ok ? bound.doc : empty;
}

export function componentSheet(item: PlanItem, newId: NewId): PlanItem | null {
  const source = item.doc;
  const mains = mainsOf(source);
  if (!mains.length) {
    return null;
  }
  let doc = backdropped(source, newId);
  for (const { main, left, top } of gridOf(mains, source.width - 2 * MARGIN_PX)) {
    const placed = placeInstance(doc, source, main.id, newId, { x: (MARGIN_PX + left - main.box.left) / source.width, y: (MARGIN_PX + top - main.box.top) / source.height });
    doc = placed.ok ? placed.doc : doc;
  }
  const inside = insideComps(doc);
  return { ...item, doc, name: SHEET_NAME, centre: { x: item.centre.x + item.size.width + BESIDE_PX, y: item.centre.y }, images: item.images.filter((i) => inside.has(i.clipId)) };
}
