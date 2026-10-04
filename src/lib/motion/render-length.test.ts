import { describe, expect, it } from 'vitest';
import { MAX_SECONDS } from './design';
import { RENDER_SECONDS, lengthProblem, renderSeconds } from './render-length';

describe('render length by plan', () => {
  it('no plan and Go render a minute, Starter two, Pro and Scale three', () => {
    expect([renderSeconds(null), renderSeconds('go'), renderSeconds('starter'), renderSeconds('pro'), renderSeconds('scale')]).toEqual([60, 60, 120, 180, 180]);
  });

  it('an unknown plan gets the free length', () => {
    expect(renderSeconds('enterprise-x')).toBe(60);
  });

  it('the editor lets a video be as long as the longest plan renders', () => {
    expect(MAX_SECONDS).toBe(Math.max(...Object.values(RENDER_SECONDS)));
  });

  it('a video longer than the plan renders is refused with the limit and the way up', () => {
    expect(lengthProblem(90, null)).toMatch(/60 s.*upgrade/);
    expect(lengthProblem(90, 'starter')).toBeNull();
  });
});
