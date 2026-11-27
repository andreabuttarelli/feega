import { describe, expect, it } from 'vitest';
import { sep } from 'node:path';
import { n } from './test-paths';
import { appRootOf, appsUnder, chosenApp } from './app-root';

const tree = (posixFiles: string[]) => {
  const files = posixFiles.map(n);
  return {
    has: async (path: string) => files.includes(path),
    dirs: async (path: string) => [...new Set(files.filter((f) => f.startsWith(n(`${path}/`))).map((f) => f.slice(path.length + 1).split(sep)[0]).filter((name) => !name.includes('.')))]
  };
};

describe('the app a click designs', () => {
  it('a subfolder with its own package.json is the app root', async () => {
    const fs = tree([n('/repo/package.json'), n('/repo/landing/package.json')]);

    expect(await appRootOf(n('/repo/landing'), n('/repo'), fs.has)).toBe(n('/repo/landing'));
  });

  it('a folder inside an app climbs to the nearest package.json', async () => {
    const fs = tree([n('/repo/landing/package.json')]);

    expect(await appRootOf(n('/repo/landing/src/lib'), n('/repo'), fs.has)).toBe(n('/repo/landing'));
  });

  it('a file resolves through its folder', async () => {
    const fs = tree([n('/repo/landing/package.json')]);

    expect(await appRootOf(n('/repo/landing/src/Hero.svelte'), n('/repo'), fs.has)).toBe(n('/repo/landing'));
  });

  it('a folder with a dot in its name is a folder, not a file', async () => {
    const fs = tree([n('/code/traidue.com/package.json')]);

    expect(await chosenApp(n('/code/traidue.com'), n('/code/traidue.com'), fs, async () => null)).toBe(n('/code/traidue.com'));
  });

  it('nothing above the workspace counts', async () => {
    const fs = tree([n('/package.json')]);

    expect(await appRootOf(n('/repo/x'), n('/repo'), fs.has)).toBe(null);
  });
});

describe('apps under a workspace without one at the root', () => {
  it('lists the folders with a package.json, two levels deep, skipping node_modules', async () => {
    const fs = tree([n('/repo/landing/package.json'), n('/repo/apps/web/package.json'), n('/repo/node_modules/x/package.json'), n('/repo/docs/readme.md')]);

    expect(await appsUnder(n('/repo'), fs.has, fs.dirs)).toEqual([n('/repo/apps/web'), n('/repo/landing')]);
  });
});

describe('the app a session opens', () => {
  const never = async () => {
    throw new Error('asked');
  };

  it('the folder with its own package.json opens without asking', async () => {
    const fs = tree([n('/repo/landing/package.json')]);

    expect(await chosenApp(n('/repo/landing'), n('/repo'), fs, never)).toBe(n('/repo/landing'));
  });

  it('a single app under the workspace opens without asking', async () => {
    const fs = tree([n('/repo/apps/web/package.json')]);

    expect(await chosenApp(n('/repo'), n('/repo'), fs, never)).toBe(n('/repo/apps/web'));
  });

  it('several apps ask which one, with paths relative to the workspace', async () => {
    const fs = tree([n('/repo/apps/web/package.json'), n('/repo/landing/package.json')]);
    const asked: string[][] = [];

    const app = await chosenApp(n('/repo'), n('/repo'), fs, async (apps) => (asked.push(apps.map((a) => a.label)), apps[1].app));

    expect(asked).toEqual([['apps/web', 'landing']]);
    expect(app).toBe(n('/repo/landing'));
  });

  it('no app is null', async () => {
    expect(await chosenApp(n('/repo'), n('/repo'), tree([]), never)).toBe(null);
  });
});
