import { describe, expect, it } from 'vitest';
import { MAX_SECONDS } from '@feega/motion-core/motion/design';
import { RENDER_SECONDS, lengthProblem } from './render-length';

describe('render length', () => {
  it('every org renders up to a minute', () => {
    expect(lengthProblem(RENDER_SECONDS)).toBeNull();
  });

  it('a longer video is refused with the limit', () => {
    expect(lengthProblem(90)).toMatch(/60 s/);
  });

  it('the editor never caps a video below what the server renders', () => {
    expect(MAX_SECONDS).toBeGreaterThanOrEqual(RENDER_SECONDS);
  });
});
