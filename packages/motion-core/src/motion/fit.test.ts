import { describe, expect, it } from 'vitest';
import { SAFE_INSET, safeBox } from './fit';

describe('the safe area', () => {
  it('a box wider than the frame is pulled inside the title-safe margins', () => {
    const frame = { width: 1080, height: 1920 };
    const box = safeBox({ left: -100, top: 800, width: 1280, height: 400 }, frame);

    expect(box.left).toBe(1080 * SAFE_INSET);
    expect(box.left + box.width).toBe(1080 * (1 - SAFE_INSET));
    expect(box).toMatchObject({ top: 800, height: 400 });
  });
});
