import type { VideoUse } from './media';
import type { VideoFrames } from './video-frames';

export type FrameRange = { from: number; to: number };

type Options = { frames: VideoFrames; uses: (frame: number) => VideoUse[] };

export type RamPreview = {
  fill: (range: FrameRange, signal: AbortSignal, onFrame?: (done: number) => void) => Promise<void>;
  runs: (range: FrameRange) => FrameRange[];
};

export function createRamPreview({ frames, uses }: Options): RamPreview {
  const memo = new Map<number, VideoUse[]>();
  const usesOf = (frame: number) => memo.get(frame) ?? memo.set(frame, uses(frame)).get(frame)!;
  const ready = (frame: number) => usesOf(frame).every((u) => frames.has(u.src, u.time));

  const fill = async (range: FrameRange, signal: AbortSignal, onFrame: (done: number) => void = () => {}) => {
    let done = 0;
    for (let frame = range.from; frame < range.to && !signal.aborted; frame++) {
      for (const use of usesOf(frame)) {
        if (!frames.has(use.src, use.time)) {
          await frames.at(use.src, use.time, use.width);
        }
      }
      onFrame(++done);
    }
  };

  const runs = (range: FrameRange) => {
    const out: FrameRange[] = [];
    for (let frame = range.from; frame < range.to; frame++) {
      if (!ready(frame)) {
        continue;
      }
      const last = out[out.length - 1];
      if (last && last.to === frame) {
        last.to = frame + 1;
        continue;
      }
      out.push({ from: frame, to: frame + 1 });
    }
    return out;
  };

  return { fill, runs };
}
