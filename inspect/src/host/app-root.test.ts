import { describe, expect, it } from 'vitest';
import { appRootOf, appsUnder, chosenApp } from './app-root';

const tree = (files: string[]) => ({
  has: async (path: string) => files.includes(path),
  dirs: async (path: string) => [...new Set(files.filter((f) => f.startsWith(`${path}/`)).map((f) => f.slice(path.length + 1).split('/')[0]).filter((n) => !n.includes('.')))]
});

describe('the app a click designs', () => {
  it('a subfolder with its own package.json is the app root', async () => {
    const fs = tree(['/repo/package.json', '/repo/landing/package.json']);

    expect(await appRootOf('/repo/landing', '/repo', fs.has)).toBe('/repo/landing');
  });

  it('a folder inside an app climbs to the nearest package.json', async () => {
    const fs = tree(['/repo/landing/package.json']);

    expect(await appRootOf('/repo/landing/src/lib', '/repo', fs.has)).toBe('/repo/landing');
  });

  it('a file resolves through its folder', async () => {
    const fs = tree(['/repo/landing/package.json']);

    expect(await appRootOf('/repo/landing/src/Hero.svelte', '/repo', fs.has)).toBe('/repo/landing');
  });

  it('nothing above the workspace counts', async () => {
    const fs = tree(['/package.json']);

    expect(await appRootOf('/repo/x', '/repo', fs.has)).toBe(null);
  });
});

describe('apps under a workspace without one at the root', () => {
  it('lists the folders with a package.json, two levels deep, skipping node_modules', async () => {
    const fs = tree(['/repo/landing/package.json', '/repo/apps/web/package.json', '/repo/node_modules/x/package.json', '/repo/docs/readme.md']);

    expect(await appsUnder('/repo', fs.has, fs.dirs)).toEqual(['/repo/apps/web', '/repo/landing']);
  });
});

describe('the app a session opens', () => {
  const never = async () => {
    throw new Error('asked');
  };

  it('the folder with its own package.json opens without asking', async () => {
    const fs = tree(['/repo/landing/package.json']);

    expect(await chosenApp('/repo/landing', '/repo', fs, never)).toBe('/repo/landing');
  });

  it('a single app under the workspace opens without asking', async () => {
    const fs = tree(['/repo/apps/web/package.json']);

    expect(await chosenApp('/repo', '/repo', fs, never)).toBe('/repo/apps/web');
  });

  it('several apps ask which one, with paths relative to the workspace', async () => {
    const fs = tree(['/repo/apps/web/package.json', '/repo/landing/package.json']);
    const asked: string[][] = [];

    const app = await chosenApp('/repo', '/repo', fs, async (apps) => (asked.push(apps.map((a) => a.label)), apps[1].app));

    expect(asked).toEqual([['apps/web', 'landing']]);
    expect(app).toBe('/repo/landing');
  });

  it('no app is null', async () => {
    expect(await chosenApp('/repo', '/repo', tree([]), never)).toBe(null);
  });
});
