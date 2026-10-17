import type { Size } from './matrix';

export enum PatternKind {
  Dots = 'dots',
  Grid = 'grid',
  Glow = 'glow'
}

export type Pattern = { kind: PatternKind; color: string };

const COLOR = /(#[0-9a-f]{3,8}|rgba?\([^)]*\))/i;

const MATCH: [RegExp, PatternKind][] = [
  [/^radial-gradient\((ellipse|at )/, PatternKind.Glow],
  [/^radial-gradient\(/, PatternKind.Dots],
  [/^linear-gradient\(/, PatternKind.Grid]
];

export function patternOf(css: string): Pattern | null {
  const kind = MATCH.find(([re]) => re.test(css.trim()))?.[1];
  const color = COLOR.exec(css)?.[1];
  return kind && color ? { kind, color } : null;
}

function clear(color: string): string {
  const pen = new OffscreenCanvas(1, 1).getContext('2d') as OffscreenCanvasRenderingContext2D;
  pen.fillStyle = color;
  pen.fillRect(0, 0, 1, 1);
  const [r, g, b] = pen.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, 0)`;
}

const DOT = { tile: 26, radius: 1.4 };
const GRID = { tile: 64, line: 1 };
const GLOW = { x: 0.7, y: 0.2, stop: 0.6 };

export const PAINT_PATTERN: Record<PatternKind, (pen: CanvasRenderingContext2D, size: Size, color: string) => void> = {
  [PatternKind.Dots]: (pen, size, color) => {
    pen.fillStyle = color;
    for (let y = 0; y < size.height; y += DOT.tile) {
      for (let x = 0; x < size.width; x += DOT.tile) {
        pen.beginPath();
        pen.arc(x + DOT.tile / 2, y + DOT.tile / 2, DOT.radius, 0, Math.PI * 2);
        pen.fill();
      }
    }
  },
  [PatternKind.Grid]: (pen, size, color) => {
    pen.fillStyle = color;
    for (let y = 0; y < size.height; y += GRID.tile) {
      pen.fillRect(0, y, size.width, GRID.line);
    }
    for (let x = 0; x < size.width; x += GRID.tile) {
      pen.fillRect(x, 0, GRID.line, size.height);
    }
  },
  [PatternKind.Glow]: (pen, size, color) => {
    const cx = size.width * GLOW.x;
    const cy = size.height * GLOW.y;
    const rx = Math.max(cx, size.width - cx) * Math.SQRT2;
    const ry = Math.max(cy, size.height - cy) * Math.SQRT2;
    pen.save();
    pen.translate(cx, cy);
    pen.scale(1, ry / rx);
    const glow = pen.createRadialGradient(0, 0, 0, 0, 0, rx);
    glow.addColorStop(0, color);
    glow.addColorStop(GLOW.stop, clear(color));
    pen.fillStyle = glow;
    pen.fillRect(-cx, -cy * (rx / ry), size.width, size.height * (rx / ry));
    pen.restore();
  }
};
