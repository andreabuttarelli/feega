import { describe, expect, it } from 'vitest';
import { FrameStalled, withDeadline } from './deadline';

describe('withDeadline', () => {
  it('passes a frame that arrives in time through', async () => {
    expect(await withDeadline(Promise.resolve(7), 50, 'frame 1')).toBe(7);
  });

  it('gives up on a frame that never arrives, so the export can be redone elsewhere', async () => {
    await expect(withDeadline(new Promise(() => {}), 10, 'frame 3')).rejects.toBeInstanceOf(FrameStalled);
  });
});
