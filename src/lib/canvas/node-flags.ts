import { layoutOf } from './node-layout';

export enum NodeFlag {
  Hidden = 'hidden',
  Locked = 'locked'
}

export type NodeFlags = Record<NodeFlag, boolean>;

type Flagged = { id: string; data: Record<string, unknown> };

export const flagsOf = (data: Record<string, unknown>): NodeFlags => ({
  [NodeFlag.Hidden]: data[NodeFlag.Hidden] === true,
  [NodeFlag.Locked]: data[NodeFlag.Locked] === true
});

export function flagHeld(nodes: readonly Flagged[], id: string, flag: NodeFlag): boolean {
  const node = nodes.find((n) => n.id === id);
  if (!node) {
    return false;
  }
  if (flagsOf(node.data)[flag]) {
    return true;
  }
  const group = layoutOf(node.data).groupId;
  return group !== null && group !== id && flagHeld(nodes, group, flag);
}

export function toggledFlags(nodes: readonly Flagged[], ids: readonly string[], flag: NodeFlag): { id: string; patch: Record<string, boolean> }[] {
  const picked = nodes.filter((n) => ids.includes(n.id));
  const on = !picked.every((n) => flagsOf(n.data)[flag]);
  return picked.map((n) => ({ id: n.id, patch: { [flag]: on } }));
}
