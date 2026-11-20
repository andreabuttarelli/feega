import { Place } from '@feega/live-edit/move-node';
import { StructureOp } from '@feega/live-edit/structure';
import { ToHost, type HostMessage, type Pick, type Source } from '../messages';
import { sourceText } from './page-bridge';
import type { Box } from './hint-boxes';

export enum DropKind {
  Sibling = 'sibling',
  Inside = 'inside',
  Loop = 'loop'
}

export type Drop = { kind: DropKind; target: Source; place: Place; line: Box; loop?: { from: number; to: number } };

const CENTRE_BAND = 0.25;

const same = (a: Source | undefined, b: Source | undefined) => !!a && !!b && a.file === b.file && a.line === b.line && a.col === b.col;

const sideBySide = (a: Pick['rect'], b: Pick['rect']) => a.y < b.y + b.height && b.y < a.y + a.height;

function lineAround(dragged: Pick, target: Pick, at: { x: number; y: number }): { place: Place; line: Box } {
  const r = target.rect;
  if (sideBySide(dragged.rect, r)) {
    const before = at.x < r.x + r.width / 2;
    return { place: before ? Place.Before : Place.After, line: { x: before ? r.x : r.x + r.width, y: r.y, w: 0, h: r.height } };
  }
  const before = at.y < r.y + r.height / 2;
  return { place: before ? Place.Before : Place.After, line: { x: r.x, y: before ? r.y : r.y + r.height, w: r.width, h: 0 } };
}

function inCentre(target: Pick, at: { x: number; y: number }): boolean {
  const r = target.rect;
  const within = (value: number, start: number, size: number) => value > start + size * CENTRE_BAND && value < start + size * (1 - CENTRE_BAND);
  return target.elements > 0 && within(at.x, r.x, r.width) && within(at.y, r.y, r.height);
}

function loopDrop(dragged: Pick, target: Pick, at: { x: number; y: number }): Drop | null {
  const { place, line } = lineAround(dragged, target, at);
  const dest = target.instanceIndex + (place === Place.After ? 1 : 0);
  const to = dragged.instanceIndex < dest ? dest - 1 : dest;
  return { kind: DropKind.Loop, target: target.source, place, line, loop: { from: dragged.instanceIndex, to } };
}

export function dropOf(dragged: Pick, target: Pick, at: { x: number; y: number }): Drop | null {
  if (same(dragged.source, target.source)) {
    return dragged.instances > 1 && dragged.instanceIndex !== target.instanceIndex ? loopDrop(dragged, target, at) : null;
  }
  if (target.ancestors.some((a) => same(a.source, dragged.source))) {
    return null;
  }
  if (inCentre(target, at)) {
    const r = target.rect;
    return { kind: DropKind.Inside, target: target.source, place: Place.Inside, line: { x: r.x, y: r.y, w: r.width, h: r.height } };
  }
  if (!same(dragged.ancestors.at(-1)?.source, target.ancestors.at(-1)?.source)) {
    return null;
  }
  return { kind: DropKind.Sibling, target: target.source, ...lineAround(dragged, target, at) };
}

export const DROP_MESSAGES: Record<DropKind, (from: Pick, drop: Drop) => HostMessage> = {
  [DropKind.Sibling]: (from, drop) => ({ kind: ToHost.Move, from: sourceText(from.source), to: sourceText(drop.target), place: drop.place }),
  [DropKind.Inside]: (from, drop) => ({ kind: ToHost.Structure, op: StructureOp.MoveInto, at: sourceText(from.source), to: sourceText(drop.target) }),
  [DropKind.Loop]: (from, drop) => ({ kind: ToHost.Structure, op: StructureOp.MoveLoopItem, at: sourceText(from.source), loop: drop.loop })
};
