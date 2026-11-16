import { describe, expect, it } from 'vitest';
import { overlayOpsOn } from './overlay-ops-switch';

describe('overlayOpsOn', () => {
  it('sends overlay chunks unless told otherwise', () => {
    expect(overlayOpsOn('', null)).toBe(true);
  });

  it('lets the url beat storage, and storage beat the default', () => {
    expect(overlayOpsOn('?overlayOps=0', '1')).toBe(false);
    expect(overlayOpsOn('?overlayOps=1', '0')).toBe(true);
    expect(overlayOpsOn('', '0')).toBe(false);
  });
});
