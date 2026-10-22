export enum ResizeCursor {
  Horizontal = 'ew-resize',
  Falling = 'nwse-resize',
  Vertical = 'ns-resize',
  Rising = 'nesw-resize'
}

const BY_EIGHTH = [ResizeCursor.Horizontal, ResizeCursor.Falling, ResizeCursor.Vertical, ResizeCursor.Rising];
const EIGHTH_DEG = 45;
const HALF_TURN_DEG = 180;

export const ROTATE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M6 15a7 7 0 0 1 9-9' fill='none' stroke='white' stroke-width='4'/%3E%3Cpath d='M6 15a7 7 0 0 1 9-9' fill='none' stroke='black' stroke-width='1.5'/%3E%3Cpath d='M14 2l4 4-4 4zM2 14l4 4 4-4z' fill='black' stroke='white'/%3E%3C/svg%3E\") 12 12, grab";

export function resizeCursor([x, y]: [number, number], turnDeg: number): ResizeCursor {
  const turn = (turnDeg * Math.PI) / HALF_TURN_DEG;
  const sx = x * Math.cos(turn) - y * Math.sin(turn);
  const sy = x * Math.sin(turn) + y * Math.cos(turn);
  const deg = (Math.atan2(sy, sx) * HALF_TURN_DEG) / Math.PI;
  const folded = ((deg % HALF_TURN_DEG) + HALF_TURN_DEG) % HALF_TURN_DEG;
  return BY_EIGHTH[Math.round(folded / EIGHTH_DEG) % BY_EIGHTH.length];
}
