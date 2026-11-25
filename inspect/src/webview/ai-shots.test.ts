import { describe, expect, it } from 'vitest';
import { MAX_SHOTS, attach, cameraShown } from './ai-shots';

describe('screenshots on the composer', () => {
  it('adds a picture to the ones already attached', () => {
    expect(attach(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('keeps what is attached when the page could not be drawn', () => {
    expect(attach(['a'], null)).toEqual(['a']);
  });

  it('stops at the limit so a message does not carry a gallery', () => {
    const full = Array.from({ length: MAX_SHOTS }, (_, i) => String(i));

    expect(attach(full, 'extra')).toEqual(full);
  });

  it('shows the camera only for an agent that takes images, once it is ready', () => {
    expect(cameraShown(true, true)).toBe(true);
    expect(cameraShown(false, true)).toBe(false);
    expect(cameraShown(true, false)).toBe(false);
  });
});
