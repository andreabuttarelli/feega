import { describe, expect, it } from 'vitest';
import { exportFailure } from './export-failure';

describe('exportFailure', () => {
  it('says why the server could not draw the image, not just that it failed', () => {
    expect(exportFailure({ type: 'failure', status: 502, data: { error: 'the images could not be drawn: Target closed' } })).toBe('Export failed: the images could not be drawn: Target closed');
  });

  it('a lost connection asks to try again', () => {
    expect(exportFailure({ type: 'network' })).toMatch(/connection/);
  });

  it('a server that died without an answer suggests a smaller export', () => {
    expect(exportFailure({ type: 'error', status: 504 })).toMatch(/smaller size/);
  });
});
