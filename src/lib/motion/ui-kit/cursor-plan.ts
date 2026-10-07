export type CursorClick = { x: number; y: number; at: number; target: string | null };
export type CursorPose = { x: number; y: number; click: CursorClick };
export type CursorPlan = { clicks: CursorClick[]; at: (t: number) => CursorPose };

export function cursorPlan(path: string, duration: number): CursorPlan {
  const TRAVEL = 0.55;
  const SETTLE = 0.06;
  const ENTRY = [0.12, 0.18];
  const lines = String(path)
    .split('\n')
    .map((l) => l.split('|').map((c) => c.trim()))
    .filter((c) => c[0] !== '' && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1])));
  const evenly = (i: number) => ((i + 1) * duration) / (lines.length + 1);
  const clicks = lines.map((c, i) => ({ x: Number(c[0]), y: Number(c[1]), at: c[2] && Number.isFinite(Number(c[2])) ? Number(c[2]) : evenly(i), target: c[3] || null })).sort((a, b) => a.at - b.at);
  const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const rest = { x: 0.5, y: 0.5, at: -1, target: null };

  const at = (t: number): CursorPose => {
    const next = clicks.findIndex((c) => c.at > t - SETTLE);
    const target = next < 0 ? clicks[clicks.length - 1] : clicks[next];
    if (!target) {
      return { x: rest.x, y: rest.y, click: rest };
    }
    const before = next > 0 ? clicks[next - 1] : next < 0 ? target : { x: Math.min(1, target.x + ENTRY[0]), y: Math.min(1, target.y + ENTRY[1]), at: -1, target: null };
    const start = target.at - SETTLE - TRAVEL;
    const p = ease(Math.min(1, Math.max(0, (t - start) / TRAVEL)));
    const done = next < 0 ? target : next > 0 ? clicks[next - 1] : rest;
    return { x: before.x + (target.x - before.x) * p, y: before.y + (target.y - before.y) * p, click: done };
  };

  return { clicks, at };
}
