import type { Op } from './op-queue';

export enum DrawAction {
  Element = 'drawElement',
  Frame = 'drawFrame'
}

const DRAW_ACTIONS = new Set<string>(Object.values(DrawAction));

export const isDraw = (action: string) => DRAW_ACTIONS.has(action);

export function drawOp(action: DrawAction, nodeId: string, fields: Record<string, string>): Op {
  return { opId: nodeId, action, fields: { ...fields, node_id: nodeId } };
}

export const drawnIds = (pending: readonly Op[]) => new Set(pending.filter((op) => isDraw(op.action)).map((op) => op.fields.node_id));

export function keepDrawn<T extends { id: string }>(fresh: T[], local: T[], pending: readonly Op[]): T[] {
  const waiting = drawnIds(pending);
  const known = new Set(fresh.map((tile) => tile.id));
  return [...fresh, ...local.filter((tile) => waiting.has(tile.id) && !known.has(tile.id))];
}
