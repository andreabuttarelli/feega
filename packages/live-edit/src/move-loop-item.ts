import { offsetOf, type LiveAt } from './class-patch';
import type { ReadFile } from './files';
import { loopName, piecesOf } from './loop-array';
import type { Structured } from './move-into';
import { hiddenOut } from './move-node';

export type LoopMove = { from: number; to: number };

const NOT_ARRAY = 'the loop does not run over an array literal in this file: change the order in the data source';

export async function moveLoopItem(read: ReadFile, at: LiveAt, move: LoopMove): Promise<Structured> {
  const source = await read(at.file);
  if (source === null) {
    return { ok: false, reason: `${at.file}: cannot read the file` };
  }

  const name = loopName(hiddenOut(source), offsetOf(source, at));
  const declared = name ? new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*(?::[^=]+)?=\\s*\\[`).exec(source) : null;
  const pieces = declared ? piecesOf(source, declared.index + declared[0].length - 1) : null;
  if (!pieces) {
    return { ok: false, reason: NOT_ARRAY, at };
  }
  if (!pieces[move.from] || !pieces[move.to]) {
    return { ok: false, reason: 'the item is outside the array', at };
  }

  const order = pieces.map((_, i) => i);
  order.splice(move.to, 0, ...order.splice(move.from, 1));
  const texts = pieces.map((p) => source.slice(p.start, p.end));
  const after = pieces.reduceRight((text, p, i) => text.slice(0, p.start) + texts[order[i]] + text.slice(p.end), source);
  return { ok: true, changes: [{ path: at.file, before: source, after }] };
}
