import { describe, expect, it } from 'vitest';
import { PatternKind, patternOf } from './fill-pattern';

describe('patternOf', () => {
  it('reads the brand background patterns back from their CSS', () => {
    expect(patternOf('radial-gradient(#ff550055 1.4px, transparent 1.4px)')).toEqual({ kind: PatternKind.Dots, color: '#ff550055' });
    expect(patternOf('linear-gradient(#ff550033 1px, transparent 1px), linear-gradient(90deg, #ff550033 1px, transparent 1px)')).toEqual({ kind: PatternKind.Grid, color: '#ff550033' });
    expect(patternOf('radial-gradient(ellipse at 70% 20%, #ff550066, transparent 60%)')).toEqual({ kind: PatternKind.Glow, color: '#ff550066' });
    expect(patternOf('radial-gradient(at 70% 20%, rgba(255, 85, 0, 0.4), transparent 60%)')).toEqual({ kind: PatternKind.Glow, color: 'rgba(255, 85, 0, 0.4)' });
  });

  it('reads no pattern on a solid fill', () => {
    expect(patternOf('')).toBeNull();
  });
});
