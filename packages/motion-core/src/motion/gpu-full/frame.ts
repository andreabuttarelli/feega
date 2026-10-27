export const frameAt = (seconds: number, fps: number, durationInFrames: number): number => Math.min(Math.round(seconds * fps), durationInFrames - 1);
