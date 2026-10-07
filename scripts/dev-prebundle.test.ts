import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../vite.config';

const LAZY_PACKAGE = /import\(\s*'((?:@[\w-]+\/)?[\w-]+)[^']*'\s*\)/g;

const lazyPackages = (file: string) => [...readFileSync(file, 'utf8').matchAll(LAZY_PACKAGE)].map((m) => m[1]);

describe('dev prebundle', () => {
  it('un pacchetto importato in ritardo dal client è già ottimizzato, così il primo avvio non ricarica la pagina a metà login (effect_orphan)', () => {
    const lazy = lazyPackages('src/hooks.client.ts');

    expect(lazy).toContain('@sentry/sveltekit');
    expect(config.optimizeDeps?.include ?? []).toEqual(expect.arrayContaining(lazy));
  });
});
