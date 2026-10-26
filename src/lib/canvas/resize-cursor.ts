export enum ResizeCursor {
  Horizontal = 'ew-resize',
  Falling = 'nwse-resize',
  Vertical = 'ns-resize',
  Rising = 'nesw-resize'
}

const BY_EIGHTH = [ResizeCursor.Horizontal, ResizeCursor.Falling, ResizeCursor.Vertical, ResizeCursor.Rising];
const EIGHTH_DEG = 45;
const HALF_TURN_DEG = 180;

const FULL_TURN_DEG = 360;
const ROTATE_CURSOR_BASE_DEG = 135;
const ROTATE_CURSOR_HOTSPOT = 12;

const rotateCursors = new Map<number, string>();

const rotateIcon = (turn: number) => {
  const arc = "d='M5 12A7 7 0 0 1 12 5' fill='none'";
  const heads = "d='M2 12h6l-3 4zM12 2v6l4-3z'";
  return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><g transform='rotate(${turn} 12 12)'><path ${arc} stroke='white' stroke-width='4'/><path ${arc} stroke='black' stroke-width='1.5'/><path ${heads} fill='black' stroke='white'/></g></svg>`;
};

export function rotateCursor([x, y]: [number, number], turnDeg: number): string {
  const outward = (Math.atan2(y, x) * HALF_TURN_DEG) / Math.PI + turnDeg;
  const turn = (((Math.round(outward + ROTATE_CURSOR_BASE_DEG) % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG);
  const known = rotateCursors.get(turn);
  if (known) {
    return known;
  }
  const cursor = `url("data:image/svg+xml,${encodeURIComponent(rotateIcon(turn))}") ${ROTATE_CURSOR_HOTSPOT} ${ROTATE_CURSOR_HOTSPOT}, grab`;
  rotateCursors.set(turn, cursor);
  return cursor;
}

export function resizeCursor([x, y]: [number, number], turnDeg: number): ResizeCursor {
  const turn = (turnDeg * Math.PI) / HALF_TURN_DEG;
  const sx = x * Math.cos(turn) - y * Math.sin(turn);
  const sy = x * Math.sin(turn) + y * Math.cos(turn);
  const deg = (Math.atan2(sy, sx) * HALF_TURN_DEG) / Math.PI;
  const folded = ((deg % HALF_TURN_DEG) + HALF_TURN_DEG) % HALF_TURN_DEG;
  return BY_EIGHTH[Math.round(folded / EIGHTH_DEG) % BY_EIGHTH.length];
}
