import { describe, expect, it } from 'vitest';
import { TYPE_GRID_VIEW } from './type-grid-poster/view';
import { CHECKER_VIEW } from './checker-steps-poster/view';

describe('the two original posters tag their text parts for on-canvas editing', () => {
  it('type grid: each big line and each footer column', () => {
    expect(TYPE_GRID_VIEW).toContain(`data-part="lines:' + i + '"`);
    expect(TYPE_GRID_VIEW).toContain(`data-part="footer' + (i + 1) + '"`);
  });

  it('type grid: each inline photo and each arrow is a part of its own', () => {
    expect(TYPE_GRID_VIEW).toContain(`data-part="photos:' + n + '"`);
    expect(TYPE_GRID_VIEW).toContain(`data-part="arrow:' + i + '"`);
  });

  it('checker steps: each title step, the body, the index and the marker', () => {
    expect(CHECKER_VIEW).toContain(`data-part="title:' + i + '"`);
    for (const field of ['body', 'index', 'marker']) {
      expect(CHECKER_VIEW).toContain(`${field}.setAttribute('data-part', '${field}')`);
    }
  });
});
