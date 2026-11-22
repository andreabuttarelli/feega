import { describe, expect, it } from 'vitest';
import { copyLabel, expiryLabel, otherRole, roleLabel, roleToggleLabel } from './share-view';

const NOW = Date.parse('2026-11-21T10:00:00Z');

describe('share view labels', () => {
  it('says how long is left', () => {
    expect(expiryLabel('2026-11-21T10:45:00Z', NOW)).toBe('in 45 min');
    expect(expiryLabel('2026-11-21T13:30:00Z', NOW)).toBe('in 3 h 30 min');
    expect(expiryLabel('2026-11-21T13:00:00Z', NOW)).toBe('in 3 h');
  });

  it('does not show a past or missing end', () => {
    expect(expiryLabel('2026-11-21T09:00:00Z', NOW)).toBe('now');
    expect(expiryLabel(undefined, NOW)).toBe('');
    expect(expiryLabel('nonsense', NOW)).toBe('');
  });

  it('names the roles', () => {
    expect(roleLabel('editor')).toBe('Editor');
    expect(roleLabel('viewer')).toBe('Viewer');
  });

  it('offers the other role and says what it does', () => {
    expect(otherRole('viewer')).toBe('editor');
    expect(otherRole('editor')).toBe('viewer');
    expect(roleToggleLabel('viewer')).toBe('Make editor');
    expect(roleToggleLabel('editor')).toBe('Make viewer');
  });

  it('labels the copy button', () => {
    expect(copyLabel(false)).toBe('Copy');
    expect(copyLabel(true)).toBe('Copied');
  });
});
