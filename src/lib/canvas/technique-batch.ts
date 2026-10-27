import type { SlotValue, TechniqueSlot } from './technique';

export const BATCH_MAX_ROWS = 50;

export type ColumnMapping = (number | null)[];

const DELIMITERS = [',', '\t'];

function splitLine(line: string): string[] {
  const delimiter = DELIMITERS.find((d) => line.includes(d));
  if (!delimiter) {
    return [line.trim()];
  }

  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

export function parseRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map(splitLine);
}

export const autoMapping = (slots: number, columns: number): ColumnMapping =>
  Array.from({ length: slots }, (_, i) => (i < columns ? i : null));

export function batchRowValues(inputs: TechniqueSlot[], mapping: ColumnMapping, row: string[]): SlotValue[] {
  return inputs.flatMap((slot, i) => {
    const column = mapping[i];
    const value = column === null || column === undefined ? '' : (row[column] ?? '').trim();
    return value === '' ? [] : [{ node: slot.node, value }];
  });
}
