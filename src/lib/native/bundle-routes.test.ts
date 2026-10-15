import { describe, expect, it } from 'vitest';
import { inBundle } from './bundle-routes';

describe('which pages the native bundle carries, and which open hosted', () => {
  it('the dashboard, login and the auth return are in the bundle', () => {
    for (const path of ['/app', '/app/canvases', '/app/templates', '/app/motion', '/app/credits', '/app/tools', '/login', '/auth/callback']) {
      expect(inBundle(path), path).toBe(true);
    }
  });

  it('the canvas, the editor and the server-loaded tools stay hosted', () => {
    for (const path of ['/p/p1/c/c1', '/p/p1/c/c1/motion/n1', '/app/studio', '/app/compose', '/p/p1/settings/project', '/changelog']) {
      expect(inBundle(path), path).toBe(false);
    }
  });
});
