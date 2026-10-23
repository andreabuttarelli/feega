import type { Padding } from './auto-layout';

const MAX_VALUES = 4;

const SIDES_OF: Record<number, (v: number[]) => Padding> = {
  1: ([all]) => ({ top: all, right: all, bottom: all, left: all }),
  2: ([vertical, horizontal]) => ({ top: vertical, right: horizontal, bottom: vertical, left: horizontal }),
  3: ([top, horizontal, bottom]) => ({ top, right: horizontal, bottom, left: horizontal }),
  4: ([top, right, bottom, left]) => ({ top, right, bottom, left })
};

function readValue(word: string): number | null {
  const hit = word.match(/^(\d+(?:\.\d+)?)(?:px)?$/);
  return hit ? Math.round(Number(hit[1])) : null;
}

export function parsePadding(text: string): Padding | null {
  const words = text.trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
  const values = words.map(readValue);
  if (!words.length || words.length > MAX_VALUES || values.some((v) => v === null)) {
    return null;
  }
  return SIDES_OF[words.length](values as number[]);
}

export function formatPadding(p: Padding): string {
  const even = p.top === p.right && p.right === p.bottom && p.bottom === p.left;
  if (even) {
    return `${p.top}`;
  }
  const vertical = p.top === p.bottom && p.right === p.left;
  if (vertical) {
    return `${p.top} ${p.right}`;
  }
  const mirrored = p.right === p.left;
  return (mirrored ? [p.top, p.right, p.bottom] : [p.top, p.right, p.bottom, p.left]).join(' ');
}
