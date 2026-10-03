import type { Box } from './layout';

export const SAFE_INSET = 0.05;
export const GLYPH_EM = 0.55;
export const TITLE_LINE_HEIGHT = 0.95;
const SHRINK = 0.95;
const MIN_PX = 8;

type Area = { width: number; height: number };

export function wrapLines(text: string, size: number, width: number): string[] {
  const perLine = Math.max(1, Math.floor(width / (size * GLYPH_EM)));
  return text.split('\n').flatMap((paragraph) => {
    const lines: string[] = [];
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > perLine && line) {
        lines.push(line);
        line = word;
        continue;
      }
      line = next;
    }
    return [...lines, line];
  });
}

function fits(text: string, size: number, area: Area): boolean {
  const lines = wrapLines(text, size, area.width);
  const widest = Math.max(...text.split(/\s+/).map((w) => w.length));
  return widest * size * GLYPH_EM <= area.width && lines.length * size * TITLE_LINE_HEIGHT <= area.height;
}

export function fitTitleSize(text: string, size: number, area: Area): number {
  let fitted = size;
  while (fitted > MIN_PX && !fits(text, fitted, area)) {
    fitted *= SHRINK;
  }
  return Math.round(fitted * 100) / 100;
}

export function safeBox(box: Box, frame: Area): Box {
  const minX = frame.width * SAFE_INSET;
  const maxX = frame.width * (1 - SAFE_INSET);
  const minY = frame.height * SAFE_INSET;
  const maxY = frame.height * (1 - SAFE_INSET);
  const left = Math.max(minX, box.left);
  const top = Math.max(minY, box.top);
  return { left, top, width: Math.min(maxX, box.left + box.width) - left, height: Math.min(maxY, box.top + box.height) - top };
}
