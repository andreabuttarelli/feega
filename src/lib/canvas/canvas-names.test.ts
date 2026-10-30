import { describe, expect, it } from 'vitest';
import { nextCanvasName } from './canvas-names';

describe('nextCanvasName', () => {
  it('starts at 1 on a project without untitled canvases', () => {
    expect(nextCanvasName(['Moodboard'])).toBe('Untitled canvas 1');
  });

  it('skips numbers already taken', () => {
    expect(nextCanvasName(['Untitled canvas 1', 'Untitled canvas 3'])).toBe('Untitled canvas 4');
  });
});
