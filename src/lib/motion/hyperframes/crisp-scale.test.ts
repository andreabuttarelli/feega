// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { centredAt, crispScale, keepCrisp } from './crisp-scale';

describe('crisp scale', () => {
  it('turns the player transform scale into zoom, so the frame renders at the size it is shown', () => {
    expect(crispScale('translate(-50%, -50%) scale(0.168519)')).toBe('0.168519');
  });

  it('leaves a transform without a scale alone', () => {
    expect(crispScale('translate(-50%, -50%)')).toBeNull();
    expect(crispScale('')).toBeNull();
  });

  it('centres the zoomed frame on whole pixels, so text is not resampled', () => {
    expect(centredAt({ width: 324.4, height: 183 }, { width: 323.5, height: 182 })).toEqual({ left: 0, top: 1 });
    expect(centredAt({ width: 400, height: 300 }, { width: 300, height: 200 })).toEqual({ left: 50, top: 50 });
  });

  it('keeps converting when the player rescales the frame later', async () => {
    const host = document.createElement('div');
    const frame = document.createElement('iframe');
    host.append(frame);
    frame.style.transform = 'translate(-50%, -50%) scale(0.5)';
    const stop = keepCrisp(frame);
    expect([frame.style.transform, frame.style.zoom]).toEqual(['none', '0.5']);

    frame.style.transform = 'translate(-50%, -50%) scale(0.25)';
    await new Promise((r) => setTimeout(r, 0));
    expect([frame.style.transform, frame.style.zoom]).toEqual(['none', '0.25']);
    stop();
  });
});
