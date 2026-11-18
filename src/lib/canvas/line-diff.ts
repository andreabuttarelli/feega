export enum LineMove {
  Same = 'same',
  Removed = 'removed',
  Added = 'added'
}

export type DiffLine = { move: LineMove; text: string };

const linesOf = (text: string | null) => (text === null ? [] : text.split('\n'));

function lcsTable(a: string[], b: string[]): number[][] {
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

export function lineDiff(before: string | null, after: string | null): DiffLine[] {
  const a = linesOf(before);
  const b = linesOf(after);
  const table = lcsTable(a, b);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ move: LineMove.Same, text: a[i++] });
      j++;
      continue;
    }
    if (j >= b.length || (i < a.length && table[i + 1][j] >= table[i][j + 1])) {
      out.push({ move: LineMove.Removed, text: a[i++] });
      continue;
    }
    out.push({ move: LineMove.Added, text: b[j++] });
  }
  return out;
}
