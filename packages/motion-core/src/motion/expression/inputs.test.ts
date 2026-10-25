import { describe, expect, it } from 'vitest';
import { fallbackPort, InputKey } from './inputs';

const SECONDS = Array.from({ length: 121 }, (_, i) => i / 10);

describe('fallback pointer, the cursor a video has instead of a person', () => {
  it('wanders on its own so a drop that follows the cursor still moves in a render', () => {
    const xs = SECONDS.map((s) => fallbackPort(s).read(InputKey.PointerX));
    const ys = SECONDS.map((s) => fallbackPort(s).read(InputKey.PointerY));

    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.2);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.1);
  });

  it('starts at the centre and stays well inside the frame', () => {
    expect(fallbackPort(0).read(InputKey.PointerX)).toBe(0.5);
    expect(fallbackPort(0).read(InputKey.PointerY)).toBe(0.5);
    for (const s of SECONDS) {
      for (const key of [InputKey.PointerX, InputKey.PointerY]) {
        const v = fallbackPort(s).read(key);
        expect(v).toBeGreaterThanOrEqual(0.2);
        expect(v).toBeLessThanOrEqual(0.8);
      }
    }
  });

  it('moves gently: no more than a tenth of the frame per tenth of a second', () => {
    for (let i = 1; i < SECONDS.length; i++) {
      for (const key of [InputKey.PointerX, InputKey.PointerY]) {
        expect(Math.abs(fallbackPort(SECONDS[i]).read(key) - fallbackPort(SECONDS[i - 1]).read(key))).toBeLessThan(0.1);
      }
    }
  });
});
