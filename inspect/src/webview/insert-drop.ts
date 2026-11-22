import { AddPlace, CONTAINER_TAGS } from '@feega/live-edit/add-node';
import type { Pick, Source } from '../messages';
import type { Box } from './hint-boxes';

export const ADD_DRAG_TYPE = 'application/x-feega-add';

export enum Axis {
  Row = 'row',
  Column = 'column'
}

export type InsertSpot = { target: Source; place: AddPlace; line: Box; outline: Box };

type Rect = Pick['rect'];
type Point = { x: number; y: number };

const EDGE_BAND = 0.25;

const boxOf = (r: Rect): Box => ({ x: r.x, y: r.y, w: r.width, h: r.height });

export function axisOf(styles: Record<string, string>): Axis {
  const flex = styles.display === 'flex' || styles.display === 'inline-flex';
  return flex && !(styles['flex-direction'] ?? 'row').startsWith('column') ? Axis.Row : Axis.Column;
}

export function dropIndex(at: Point, rects: Rect[], axis: Axis): { index: number; line: Box } {
  const row = axis === Axis.Row;
  const pointer = row ? at.x : at.y;
  const middle = (r: Rect) => (row ? r.x + r.width / 2 : r.y + r.height / 2);
  const index = rects.filter((r) => middle(r) < pointer).length;
  const next = rects[index];
  const last = rects[rects.length - 1];
  if (!last) {
    return { index, line: { x: at.x, y: at.y, w: 0, h: 0 } };
  }

  const edge = next ? (row ? next.x : next.y) : row ? last.x + last.width : last.y + last.height;
  const along = next ?? last;
  return { index, line: row ? { x: edge, y: along.y, w: 0, h: along.height } : { x: along.x, y: edge, w: along.width, h: 0 } };
}

export function rowPlace(ratio: number): AddPlace {
  if (ratio < EDGE_BAND) {
    return AddPlace.Before;
  }
  return ratio > 1 - EDGE_BAND ? AddPlace.After : AddPlace.Child;
}

const holds = (target: Pick) => target.elements > 0 || CONTAINER_TAGS.has(target.tag);

const centred = (r: Rect, at: Point) => rowPlace((at.y - r.y) / r.height) === AddPlace.Child && rowPlace((at.x - r.x) / r.width) === AddPlace.Child;

export function insertSpot(target: Pick, parent: Pick | null, at: Point): InsertSpot {
  const outline = boxOf(target.rect);
  if (holds(target) && centred(target.rect, at)) {
    return { target: target.source, place: AddPlace.Child, line: outline, outline };
  }

  const axis = parent ? axisOf(parent.styles) : Axis.Column;
  const { index, line } = dropIndex(at, [target.rect], axis);
  return { target: target.source, place: index === 0 ? AddPlace.Before : AddPlace.After, line, outline };
}
