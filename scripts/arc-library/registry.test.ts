import { describe, expect, it } from 'vitest';
import { freeCatalog, installable, Tier, type Catalog, type RegistryItem } from './registry';

const catalog: Catalog = {
  name: 'arc',
  homepage: 'https://uiarc.dev',
  generatedAt: '2026-11-11T16:12:22.202Z',
  items: [
    { name: 'button', title: 'Button', description: 'A button.', tier: Tier.Free, category: 'Actions', registry: 'https://uiarc.dev/r/button.json' },
    { name: 'presence-stack', title: 'Presence stack', description: 'Avatars.', tier: Tier.Pro, category: 'Social', registry: 'https://uiarc.dev/r/presence-stack.json' }
  ]
};

const item = (tier: string | undefined, target = '@components/arc/button/button.tsx'): RegistryItem => ({
  name: 'button',
  dependencies: ['motion'],
  registryDependencies: [],
  files: [{ path: 'registry/components/button/button.tsx', target, content: 'export {}' }],
  meta: tier ? { tier } : undefined
});

describe('the pinned Arc catalog', () => {
  it('keeps only the free tier', () => {
    expect(freeCatalog(catalog).items.map((i) => i.name)).toEqual(['button']);
  });
});

describe('an Arc registry item', () => {
  it('lands its files under src/components/arc', () => {
    expect(installable(item(Tier.Free))).toEqual({ ok: true, files: [{ path: 'src/components/arc/button/button.tsx', content: 'export {}' }], dependencies: ['motion'] });
  });

  it('a pro item never lands', () => {
    expect(installable(item(Tier.Pro))).toEqual({ ok: false, reason: 'button is not in the free tier' });
  });

  it('an item without a tier never lands', () => {
    expect(installable(item(undefined)).ok).toBe(false);
  });

  it('a target that climbs out of the library is refused', () => {
    expect(installable(item(Tier.Free, '@components/arc/../../package.json')).ok).toBe(false);
  });
});
