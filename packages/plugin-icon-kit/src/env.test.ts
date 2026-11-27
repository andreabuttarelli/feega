import { describe, expect, it } from 'vitest';
import { envOf } from './env';

const info = (packages: Record<string, string>, typescript = true) => ({ typescript, publicDir: 'public', packages });

describe('project environment', () => {
  it('reads TypeScript from the project', () => {
    expect(envOf(info({}, false)).typescript).toBe(false);
  });

  it('takes Svelte 5 from a caret range', () => {
    expect(envOf(info({ svelte: '^5.1.0' })).svelte5).toBe(true);
  });

  it('takes Svelte 4 from a tilde range', () => {
    expect(envOf(info({ svelte: '~4.2.8' })).svelte5).toBe(false);
  });

  it('assumes a current Svelte when the version is a tag or missing', () => {
    expect(envOf(info({ svelte: 'latest' })).svelte5).toBe(true);
    expect(envOf(info({})).svelte5).toBe(true);
  });
});
