import { AVERAGE_ADVANCE, CAPITAL_ADVANCE } from './layout/text-extent';

export type Advance = (run: string) => number;

export type TextBoxIn = { left: number; top: number; width: number; height: number };

export type TextLook = { text: string; size: number; tracking: number; leading: number; align: 'left' | 'center' | 'right'; wraps: boolean; capitals: boolean };

export type MeasuredText = { left: number; top: number; width: number; height: number; lines: string[] };

const PRECISION = 100;
const tidy = (n: number) => Math.round(n * PRECISION) / PRECISION;

const ALIGN_SHARE: Record<TextLook['align'], number> = { left: 0, center: 0.5, right: 1 };

export const guessedAdvance =
  (capitals: boolean): Advance =>
  (run) =>
    [...run].length * (capitals ? CAPITAL_ADVANCE : AVERAGE_ADVANCE);

function wrapped(line: string, room: number, widthOf: (run: string) => number): string[] {
  const words = line.split(' ');
  const rows: string[] = [];
  let row = '';
  for (const word of words) {
    const next = row ? `${row} ${word}` : word;
    if (!row || widthOf(next) <= room) {
      row = next;
      continue;
    }
    rows.push(row);
    row = word;
  }
  return [...rows, row];
}

export function measureText(look: TextLook, box: TextBoxIn, advance: Advance): MeasuredText {
  const cased = look.capitals ? look.text.toUpperCase() : look.text;
  const widthOf = (run: string) => (advance(run) + look.tracking * [...run].length) * look.size;
  const lines = cased.split('\n').flatMap((line) => (look.wraps ? wrapped(line, box.width, widthOf) : [line]));
  const width = Math.max(0, ...lines.map(widthOf));
  const height = lines.length * look.size * look.leading;
  return {
    left: tidy(box.left + (box.width - width) * ALIGN_SHARE[look.align]),
    top: tidy(box.top + (box.height - height) / 2),
    width: tidy(width),
    height: tidy(height),
    lines
  };
}
