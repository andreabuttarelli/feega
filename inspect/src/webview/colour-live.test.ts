import { describe, expect, it } from 'vitest';
import { liveColour } from './colour-live';

function harness() {
  const previews: string[] = [];
  const writes: string[] = [];
  const frames: (() => void)[] = [];
  const live = liveColour({
    preview: (v) => previews.push(v),
    commit: (v) => writes.push(v),
    frame: (run) => frames.push(run),
    later: () => () => undefined
  });
  const flushFrame = () => frames.splice(0).forEach((f) => f());
  return { live, previews, writes, flushFrame };
}

describe('colour picker drag', () => {
  it('previews every frame and writes once on release', () => {
    const { live, previews, writes, flushFrame } = harness();
    const steps = [0.2, 0.5, 0.8];
    for (const s of steps) {
      live.drag({ h: 0, s, v: 1 }, 1);
      flushFrame();
    }
    live.drop({ h: 0, s: 1, v: 1 }, 0.5);

    expect(previews).toHaveLength(steps.length);
    expect(writes).toEqual(['rgba(255, 0, 0, 0.5)']);
  });

  it('coalesces moves inside one frame into one preview', () => {
    const { live, previews, writes, flushFrame } = harness();
    live.drag({ h: 120, s: 1, v: 1 }, 1);
    live.drag({ h: 240, s: 1, v: 1 }, 1);
    flushFrame();

    expect(previews).toEqual(['#0000ff']);
    expect(writes).toEqual([]);
  });
});
