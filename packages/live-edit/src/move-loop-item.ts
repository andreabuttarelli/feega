import type { LiveAt } from './class-patch';
import type { ReadFile } from './files';
import { loopArray } from './loop-array';
import type { Structured } from './move-into';

export type LoopMove = { from: number; to: number };

export async function moveLoopItem(read: ReadFile, at: LiveAt, move: LoopMove): Promise<Structured> {
  const found = await loopArray(read, at);
  if ('reason' in found) {
    return { ok: false, ...found };
  }

  const { array } = found;
  const { pieces, text } = array;
  if (!pieces[move.from] || !pieces[move.to]) {
    return { ok: false, reason: 'the item is outside the array', at };
  }

  const order = pieces.map((_, i) => i);
  order.splice(move.to, 0, ...order.splice(move.from, 1));
  const texts = pieces.map((p) => text.slice(p.start, p.end));
  const after = pieces.reduceRight((out, p, i) => out.slice(0, p.start) + texts[order[i]] + out.slice(p.end), text);
  return { ok: true, changes: [{ path: array.path, before: text, after }] };
}
