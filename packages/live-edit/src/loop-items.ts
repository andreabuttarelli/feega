import type { LiveAt } from './class-patch';
import type { ReadFile } from './files';
import { loopArray, type ArrayLiteral } from './loop-array';
import type { Structured } from './move-into';

export enum ItemOp {
  Duplicate = 'duplicate',
  Delete = 'delete',
  Append = 'append'
}

type Rewrite = { text: string; note?: string };

const NO_POSITION = 'no position of the item given';
const OUTSIDE = 'the item is outside the array';
const NOW_EMPTY = 'the array is now empty: the loop renders nothing';
const SINGLE_LINE_GAP = ' ';

const entry = (array: ArrayLiteral, i: number) => array.text.slice(array.pieces[i].start, array.pieces[i].end);

function leadOf(array: ArrayLiteral, i: number): string {
  const { text, pieces } = array;
  const model = i > 0 ? i : pieces.length > 1 ? 1 : 0;
  const lead = text.slice(0, pieces[model].start).match(/\s*$/)![0];
  return lead || (pieces.length === 1 ? SINGLE_LINE_GAP : '');
}

function copiedAfter(array: ArrayLiteral, source: number, after: number): Rewrite {
  const end = array.pieces[after].end;
  return { text: `${array.text.slice(0, end)},${leadOf(array, after)}${entry(array, source)}${array.text.slice(end)}` };
}

function removed(array: ArrayLiteral, i: number): Rewrite {
  const { text, pieces } = array;
  if (pieces.length === 1) {
    return { text: text.slice(0, array.open + 1) + text.slice(array.close), note: NOW_EMPTY };
  }
  if (i === pieces.length - 1) {
    return { text: text.slice(0, pieces[i - 1].end) + text.slice(pieces[i].end) };
  }
  return { text: text.slice(0, pieces[i].start) + text.slice(pieces[i + 1].start) };
}

const REWRITES: Record<ItemOp, (array: ArrayLiteral, i: number) => Rewrite> = {
  [ItemOp.Duplicate]: (array, i) => copiedAfter(array, i, i),
  [ItemOp.Append]: (array, i) => copiedAfter(array, i, array.pieces.length - 1),
  [ItemOp.Delete]: removed
};

export async function loopItem(read: ReadFile, at: LiveAt, instance: number | undefined, op: ItemOp): Promise<Structured> {
  if (instance === undefined) {
    return { ok: false, reason: NO_POSITION, at };
  }

  const found = await loopArray(read, at);
  if ('reason' in found) {
    return { ok: false, ...found };
  }

  const { array } = found;
  if (!array.pieces[instance]) {
    return { ok: false, reason: OUTSIDE, at };
  }

  const { text, note } = REWRITES[op](array, instance);
  return { ok: true, changes: [{ path: array.path, before: array.text, after: text }], note };
}
