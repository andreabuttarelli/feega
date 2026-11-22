import { describe, expect, it } from 'vitest';
import { ACTIVE_WINDOW_DAYS, activeSince, isPluginId } from './listing';

describe('plugin id', () => {
  it('accepts lowercase slugs', () => {
    expect(isPluginId('mesh-gradient')).toBe(true);
    expect(isPluginId('3d-object')).toBe(true);
  });

  it('rejects anything else', () => {
    for (const id of ['', 'Mesh', 'a b', '-a', 'a/b', 'a'.repeat(65)]) {
      expect(isPluginId(id)).toBe(false);
    }
  });
});

describe('active window', () => {
  it('is 30 days back from now', () => {
    const now = new Date('2026-11-22T00:00:00Z');

    expect(ACTIVE_WINDOW_DAYS).toBe(30);
    expect(activeSince(now).toISOString()).toBe('2026-10-23T00:00:00.000Z');
  });
});
