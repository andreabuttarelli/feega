import { describe, expect, it } from 'vitest';
import { n } from './test-paths';
import { Framework } from '@feega/dev-run/run-plan';
import { DepsOutcome, depsMissing, ensureDeps } from './deps';

const has = (files: string[]) => async (path: string) => files.includes(path);

describe('installed dependencies', () => {
  it('missing when the framework binary is nowhere up to the workspace', async () => {
    expect(await depsMissing(n('/repo/web-docs'), n('/repo'), Framework.Astro, has([]))).toBe(true);
  });

  it('found in the app', async () => {
    expect(await depsMissing(n('/repo/landing'), n('/repo'), Framework.SvelteKit, has([n('/repo/landing/node_modules/.bin/vite')]))).toBe(false);
  });

  it('found hoisted to the workspace root', async () => {
    expect(await depsMissing(n('/repo/apps/web'), n('/repo'), Framework.Next, has([n('/repo/node_modules/.bin/next')]))).toBe(false);
  });

  it('nothing above the workspace counts', async () => {
    expect(await depsMissing(n('/repo/app'), n('/repo'), Framework.Vite, has([n('/node_modules/.bin/vite')]))).toBe(true);
  });
});

describe('missing dependencies install before the server starts', () => {
  const run = (missing: boolean, install: DepsOutcome) => {
    const calls: string[] = [];
    const out = ensureDeps({
      missing: async () => missing,
      install: async () => (calls.push('install'), install)
    });
    return { out, calls };
  };

  it('present: no install', async () => {
    const { out, calls } = run(false, DepsOutcome.Installed);
    expect(await out).toBe(DepsOutcome.Ready);
    expect(calls).toEqual([]);
  });

  it('missing: installs, then ready to start', async () => {
    const { out, calls } = run(true, DepsOutcome.Installed);
    expect(await out).toBe(DepsOutcome.Installed);
    expect(calls).toEqual(['install']);
  });

  it('cancelled or failed install: no start', async () => {
    expect(await run(true, DepsOutcome.Cancelled).out).toBe(DepsOutcome.Cancelled);
    expect(await run(true, DepsOutcome.Failed).out).toBe(DepsOutcome.Failed);
  });
});
