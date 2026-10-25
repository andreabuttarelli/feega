export type Box = { top: number; own: string };
export type Boxes = Record<string, Box>;
export type BoxShot = { time: number; boxes: Boxes };

const MOVE_PX = 1;
const MAX_FLAGGED = 3;

const seconds = (t: number) => `${Math.round(t * 100) / 100}s`;

function inTimeOrder(shots: BoxShot[]): BoxShot[] {
  const first = new Map<number, BoxShot>();
  shots.forEach((s) => first.set(s.time, first.get(s.time) ?? s));
  return [...first.values()].sort((a, b) => a.time - b.time);
}

export function reflowProblems(shots: BoxShot[]): string[] {
  const ordered = inTimeOrder(shots);
  const flagged = new Map<string, string>();
  for (let i = 1; i < ordered.length; i++) {
    const before = ordered[i - 1].boxes;
    for (const [path, box] of Object.entries(ordered[i].boxes)) {
      const was = before[path];
      if (!was || flagged.has(path) || was.own !== box.own || Math.abs(box.top - was.top) < MOVE_PX) {
        continue;
      }
      const moved = Math.round(Math.abs(box.top - was.top));
      flagged.set(path, `${path} moves ${moved}px at ${seconds(ordered[i].time)} without a tween of its own: something next to it changes size, display or margin. Animate entrances with transform and opacity only, and keep the final layout from frame 0`);
    }
  }
  return [...flagged.values()].slice(0, MAX_FLAGGED);
}
