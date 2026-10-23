export enum SwipeStep {
  Next = 1,
  Previous = -1,
  None = 0
}

const SWIPE_MIN_PX = 48;

export function adjacentFrame(frames: { id: string }[], currentId: string, step: SwipeStep): string | null {
  const at = frames.findIndex((frame) => frame.id === currentId);
  if (at < 0) {
    return null;
  }
  return frames[at + step]?.id ?? null;
}

export function swipeStep(dx: number, dy: number): SwipeStep {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy)) {
    return SwipeStep.None;
  }
  return dx < 0 ? SwipeStep.Next : SwipeStep.Previous;
}
