import { describe, expect, it } from 'vitest';
import { FillType } from './fill/model';
import { MIXED } from './text-runs';
import { RunPaint, asGradient, gradientPatched, paintOf } from './run-fill';

describe('run fill', () => {
  it('reads a range as solid, gradient or mixed', () => {
    expect(paintOf({ fill: undefined, color: '#fff' })).toBe(RunPaint.Solid);
    expect(paintOf({ fill: asGradient(undefined, FillType.Linear, '#ff0000'), color: undefined })).toBe(RunPaint.Gradient);
    expect(paintOf({ fill: MIXED, color: '#fff' })).toBe(RunPaint.Mixed);
    expect(paintOf({ fill: undefined, color: MIXED })).toBe(RunPaint.Mixed);
  });

  it('a fresh gradient starts from the current colour', () => {
    const fill = asGradient(undefined, FillType.Radial, '#ff0000');
    expect(fill.type).toBe(FillType.Radial);
    expect(fill.stops[0].color).toBe('#ff0000');
  });

  it('switching gradient type keeps the first colour', () => {
    const linear = gradientPatched(asGradient(undefined, FillType.Linear, '#ff0000'), {
      stops: [
        { color: '#00ff00', pos: 0 },
        { color: '#0000ff', pos: 1 }
      ]
    });
    const angular = asGradient(linear, FillType.Angular, '#000000');
    expect(angular.type).toBe(FillType.Angular);
    expect(angular.stops[0].color).toBe('#00ff00');
  });

  it('patches the angle of a linear gradient', () => {
    const fill = gradientPatched(asGradient(undefined, FillType.Linear, '#ff0000'), { angle: 45 });
    expect(fill.type === FillType.Linear && fill.angle).toBe(45);
  });
});
