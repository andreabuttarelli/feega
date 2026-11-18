import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_FEEGA_LOCAL: '1' } }));

const { navEntriesByGroup, railEntries } = await import('./shell-nav');

describe('la rail in modalita locale', () => {
  it('apre la History dalla rail, come nel cloud', () => {
    expect(navEntriesByGroup('panel').map((e) => e.id)).toContain('history');
  });

  it('tiene fuori dalla rail le voci che servono il cloud', () => {
    const ids = railEntries('panel').map((e) => e.id);
    expect(ids).not.toContain('influencers');
  });
});
