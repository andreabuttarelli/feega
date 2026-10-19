import { isNodeType } from '../node-data';

export type ClaimTile = { id: string; kind?: string };

export type CoreState = { on: boolean; refused: ReadonlySet<string>; dom: ReadonlySet<string> };

const FRAME = 'motion';

export function claimedByCore(t: ClaimTile, s: CoreState): boolean {
  if (!s.on || !t.kind) {
    return false;
  }
  if (t.kind === FRAME) {
    return !s.refused.has(t.id);
  }
  return isNodeType(t.kind) && !s.dom.has(t.id);
}
