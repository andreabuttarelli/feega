export const POSTER_SHARE = 0.4;

export function posterSecond(doc: { durationInFrames: number; fps: number }): number {
  return (doc.durationInFrames / doc.fps) * POSTER_SHARE;
}
