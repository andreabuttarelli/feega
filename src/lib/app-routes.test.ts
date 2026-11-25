import { describe, expect, it } from 'vitest';
import { isReachable } from './app-routes';

describe('app routes', () => {
  it.each(['/app', '/app/', '/app/settings/profile', '/app/settings/billing', '/app/admin/stats'])('%s stays reachable', (path) => {
    expect(isReachable(path)).toBe(true);
  });

  it.each(['/app/canvases', '/app/motion/x', '/app/settings', '/app/settings/team', '/app/tools', '/app/profile'])('%s is not reachable', (path) => {
    expect(isReachable(path)).toBe(false);
  });
});
