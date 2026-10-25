export type Warp = { t: number; end: number; play: number };

export function playedDuration(recorded: number, warps: Warp[]): number {
  return warps.reduce((total, w) => total - (w.end - w.t) + w.play, recorded);
}

export function recordedAt(played: number, warps: Warp[]): number {
  let shift = 0;
  for (const w of [...warps].sort((a, b) => a.t - b.t)) {
    const start = w.t - shift;
    if (played < start) {
      break;
    }
    if (played < start + w.play) {
      return w.t + ((played - start) / w.play) * (w.end - w.t);
    }
    shift += w.end - w.t - w.play;
  }
  return played + shift;
}
