type ScreenSource = { src?: string; currentSrc?: string; currentTime?: number; naturalWidth?: number; videoWidth?: number } | null;

export function drawOnce(draw: (time: number) => void, sources: () => string = () => ''): { at: (time: number) => void; again: (time?: number) => void } {
  let drawn: string | null = null;
  let last = 0;
  const paint = (time: number) => {
    last = time;
    drawn = `${time}#${sources()}`;
    draw(time);
  };
  return {
    at: (time) => {
      if (`${time}#${sources()}` !== drawn) {
        paint(time);
      }
    },
    again: (time = last) => paint(time)
  };
}

export function screenKey(source: ScreenSource, scroll: number): string {
  if (!source) {
    return 'none';
  }
  const SRC_TAIL = 64;
  const time = source.currentTime === undefined ? '' : source.currentTime;
  const url = source.currentSrc || source.src || '';
  return `${url.length}:${url.slice(-SRC_TAIL)}|${time}|${source.videoWidth || source.naturalWidth || 0}|${scroll}`;
}

type Size = { width: number; height: number };
export type Placement = { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number };

export function screenPlacement(source: Size, canvas: Size, fit: string, scroll: number, safeTop: number): Placement {
  const whole = { sx: 0, sy: 0, sw: source.width, sh: source.height };
  const inside = (top: number): Placement => {
    const room = { width: canvas.width, height: canvas.height - top };
    const scale = Math.min(room.width / source.width, room.height / source.height);
    const dw = source.width * scale;
    const dh = source.height * scale;
    return { ...whole, dx: (canvas.width - dw) / 2, dy: top + (room.height - dh) / 2, dw, dh };
  };
  const cover = (): Placement => {
    const tall = source.height / source.width > canvas.height / canvas.width;
    const scale = tall ? canvas.width / source.width : Math.max(canvas.width / source.width, canvas.height / source.height);
    const sw = canvas.width / scale;
    const sh = canvas.height / scale;
    const sy = tall ? scroll * (source.height - sh) : (source.height - sh) / 2;
    return { sx: (source.width - sw) / 2, sy, sw, sh, dx: 0, dy: 0, dw: canvas.width, dh: canvas.height };
  };
  const FITS: Record<string, () => Placement> = { cover, contain: () => inside(0), safe: () => inside(safeTop * canvas.height) };
  return (FITS[fit] ?? cover)();
}

type Point = [number, number];
type DepthPoint = [number, number, number];

export function quadMatrix(width: number, height: number, quad: Point[]): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = det ? (dx3 * dy2 - dx2 * dy3) / det : 0;
  const h = det ? (dx1 * dy3 - dx3 * dy1) / det : 0;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  const m = [a / width, d / width, 0, g / width, b / height, e / height, 0, h / height, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.join(',')})`;
}

export function faceShown(quad: DepthPoint[]): boolean {
  const inFront = quad.every(([, , z]) => z > -1 && z < 1);
  const area = quad.reduce((sum, [x, y], i) => {
    const [nx, ny] = quad[(i + 1) % quad.length];
    return sum + x * ny - nx * y;
  }, 0);
  return inFront && area > 0;
}
