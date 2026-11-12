import { describe, expect, it } from 'vitest';
import { appOf, Framework, Manager, NodeLine, planFile, PlanRefusal, runPlan, textsWanted, type RepoFacts } from './run-plan';

const SANDBOX = { host: '0.0.0.0', port: 4174 };
const LOOPBACK = { host: '127.0.0.1', port: 51234 };

const NEXT_FLAGS = ['-H', '0.0.0.0', '-p', '4174'];
const VITE_FLAGS = ['--host', '0.0.0.0', '--port', '4174', '--strictPort'];
const PORT_HOST_FLAGS = ['--port', '4174', '--host', '0.0.0.0'];

const NPM_INSTALL = ['npm', 'install', '--no-audit', '--no-fund', '--loglevel=error'];
const PNPM_INSTALL = ['pnpm', 'install', '--reporter=append-only', '--config.strict-dep-builds=false'];

type Texts = Record<string, object | string>;

function repo(texts: Texts, names: string[] = []): RepoFacts {
  const read = Object.fromEntries(Object.entries(texts).map(([path, body]) => [path, typeof body === 'string' ? body : JSON.stringify(body)]));
  return { files: [...Object.keys(texts), ...names], texts: read };
}

const SHADCN_UI = repo(
  {
    'package.json': { name: 'ui', packageManager: 'pnpm@10.33.4', workspaces: ['apps/*', 'packages/*'], scripts: { dev: 'turbo run dev' }, devDependencies: { turbo: '2', vite: '7' } },
    '.nvmrc': 'v20.5.1\n',
    'apps/v4/package.json': { name: 'v4', scripts: { dev: 'pnpm icons:dev & next dev --turbopack --port 4000', start: 'next start --port 4000' }, dependencies: { next: '16' } },
    'packages/shadcn/package.json': { name: 'shadcn', engines: { node: '>=20.18.1' }, scripts: { dev: 'tsup --watch', start: 'node dist/index.js' } }
  },
  ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'turbo.json', 'apps/v4/next.config.mjs']
);

const TWO_APPS = repo(
  {
    'package.json': { name: 'mono', workspaces: ['apps/*'], scripts: { dev: 'turbo run dev' } },
    'apps/web/package.json': { scripts: { dev: 'next dev' }, dependencies: { next: '15' } },
    'apps/docs/package.json': { scripts: { dev: 'astro dev' }, dependencies: { astro: '5' } }
  },
  ['package-lock.json', 'turbo.json']
);

const PLANS: { name: string; facts: RepoFacts; app?: string; want: object }[] = [
  {
    name: 'traidue.com: SvelteKit, bun.lock beside package-lock.json',
    facts: repo({ 'package.json': { name: 'traidue.com', scripts: { dev: 'vite dev' }, devDependencies: { '@sveltejs/kit': '2', vite: '7' } } }, ['bun.lock', 'package-lock.json', 'svelte.config.js', 'vite.config.ts']),
    want: { framework: Framework.SvelteKit, manager: Manager.Bun, install: ['bun', 'install'], dev: ['bun', 'run', 'dev', ...VITE_FLAGS], node: NodeLine.Node24, appDir: '' }
  },
  {
    name: 'next-shadcn-admin-dashboard: Next 16 on npm',
    facts: repo({ 'package.json': { name: 'studio-admin', scripts: { dev: 'next dev', start: 'next start' }, dependencies: { next: '16' } } }, ['package-lock.json', 'next.config.mjs']),
    want: { framework: Framework.Next, manager: Manager.Npm, install: NPM_INSTALL, dev: ['npm', 'run', 'dev', '--', ...NEXT_FLAGS], defaultPort: 3000 }
  },
  {
    name: 'shadcn-admin: Vite React on pnpm',
    facts: repo({ 'package.json': { name: 'shadcn-admin', scripts: { dev: 'vite' }, devDependencies: { vite: '7' } } }, ['pnpm-lock.yaml', 'vite.config.ts']),
    want: { framework: Framework.Vite, manager: Manager.Pnpm, install: PNPM_INSTALL, dev: ['pnpm', 'run', 'dev', ...VITE_FLAGS], defaultPort: 5173 }
  },
  {
    name: 'nuxt-ui-templates/dashboard: Nuxt 4, pinned pnpm, a pnpm-workspace.yaml with no packages',
    facts: repo({ 'package.json': { name: 'nuxt-ui-template-dashboard', packageManager: 'pnpm@12.18.0', scripts: { dev: 'nuxt dev' }, dependencies: { nuxt: '4' } } }, ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'nuxt.config.ts']),
    want: { framework: Framework.Nuxt, appDir: '', installDir: '', install: ['npx', '-y', 'pnpm@12.18.0', 'install', '--reporter=append-only', '--config.strict-dep-builds=false'], dev: ['npx', '-y', 'pnpm@12.18.0', 'run', 'dev', ...PORT_HOST_FLAGS] }
  },
  {
    name: 'shadcn-ui/ui: the one app of a pnpm + turbo monorepo, installed at the root, run in apps/v4',
    facts: SHADCN_UI,
    want: { framework: Framework.Next, appDir: 'apps/v4', installDir: '', node: NodeLine.Node22, dev: ['npx', '-y', 'pnpm@10.33.4', 'run', 'dev', ...NEXT_FLAGS] }
  },
  {
    name: 'shadcn-ui/ui with tree/main/apps/v4',
    facts: SHADCN_UI,
    app: 'apps/v4',
    want: { framework: Framework.Next, appDir: 'apps/v4', installDir: '' }
  },
  {
    name: 'nextjs/saas-starter: Next on pnpm',
    facts: repo({ 'package.json': { scripts: { dev: 'next dev --turbopack', start: 'next start' }, dependencies: { next: '15' } } }, ['pnpm-lock.yaml', 'next.config.ts']),
    want: { framework: Framework.Next, dev: ['pnpm', 'run', 'dev', ...NEXT_FLAGS] }
  },
  {
    name: 'Create React App: only start, yarn classic, port and host through the environment',
    facts: repo({ 'package.json': { scripts: { start: 'react-scripts start', build: 'react-scripts build' }, dependencies: { 'react-scripts': '5' } } }, ['yarn.lock']),
    want: { framework: Framework.Cra, manager: Manager.Yarn, install: ['npx', '-y', 'yarn@1', 'install', '--non-interactive', '--silent'], dev: ['npx', '-y', 'yarn@1', 'run', 'start'], env: expect.objectContaining({ PORT: '4174', HOST: '0.0.0.0', BROWSER: 'none' }) }
  },
  {
    name: 'Astro',
    facts: repo({ 'package.json': { scripts: { dev: 'astro dev', start: 'astro dev' }, dependencies: { astro: '5' } } }, ['package-lock.json', 'astro.config.mjs']),
    want: { framework: Framework.Astro, dev: ['npm', 'run', 'dev', '--', ...PORT_HOST_FLAGS], defaultPort: 4321 }
  },
  {
    name: 'Angular: ng serve behind start',
    facts: repo({ 'package.json': { scripts: { ng: 'ng', start: 'ng serve', build: 'ng build' }, devDependencies: { '@angular/cli': '20' } } }, ['package-lock.json', 'angular.json']),
    want: { framework: Framework.Angular, dev: ['npm', 'run', 'start', '--', ...PORT_HOST_FLAGS], defaultPort: 4200 }
  },
  {
    name: 'Gatsby: develop',
    facts: repo({ 'package.json': { scripts: { develop: 'gatsby develop', start: 'gatsby develop' }, dependencies: { gatsby: '5' } } }, ['package-lock.json', 'gatsby-config.ts']),
    want: { framework: Framework.Gatsby, dev: ['npm', 'run', 'develop', '--', '-H', '0.0.0.0', '-p', '4174'], defaultPort: 8000 }
  },
  {
    name: 'React Router 7',
    facts: repo({ 'package.json': { scripts: { dev: 'react-router dev' }, devDependencies: { '@react-router/dev': '7', vite: '6' } } }, ['package-lock.json', 'react-router.config.ts']),
    want: { framework: Framework.ReactRouter, dev: ['npm', 'run', 'dev', '--', ...VITE_FLAGS] }
  },
  {
    name: 'yarn Berry pinned by packageManager',
    facts: repo({ 'package.json': { packageManager: 'yarn@4.5.1+sha512.abc', scripts: { dev: 'vite' }, devDependencies: { vite: '6' } } }, ['yarn.lock', '.yarnrc.yml']),
    want: {
      manager: Manager.YarnBerry,
      install: ['npx', '-y', '-p', '@yarnpkg/cli-dist@4.5.1', 'yarn', 'install'],
      dev: ['npx', '-y', '-p', '@yarnpkg/cli-dist@4.5.1', 'yarn', 'run', 'dev', ...VITE_FLAGS],
      env: expect.objectContaining({ YARN_ENABLE_IMMUTABLE_INSTALLS: 'false' })
    }
  },
  {
    name: 'yarn Berry from .yarnrc.yml alone',
    facts: repo({ 'package.json': { scripts: { dev: 'vite' }, devDependencies: { vite: '6' } } }, ['yarn.lock', '.yarnrc.yml']),
    want: { manager: Manager.YarnBerry, install: ['npx', '-y', '-p', '@yarnpkg/cli-dist@latest', 'yarn', 'install'] }
  },
  {
    name: 'bun pinned by packageManager runs on the image that has Node 24',
    facts: repo({ 'package.json': { packageManager: 'bun@1.1.38', engines: { node: '20' }, scripts: { dev: 'next dev' }, dependencies: { next: '15' } } }, ['bun.lockb']),
    want: { manager: Manager.Bun, install: ['npx', '-y', 'bun@1.1.38', 'install'], node: NodeLine.Node24 }
  },
  {
    name: 'packageManager wins over the lockfile',
    facts: repo({ 'package.json': { packageManager: 'pnpm@9.15.0', scripts: { dev: 'vite' }, devDependencies: { vite: '6' } } }, ['package-lock.json']),
    want: { manager: Manager.Pnpm }
  },
  {
    name: 'no framework: the start script, port through the environment',
    facts: repo({ 'package.json': { scripts: { start: 'node server.js' }, dependencies: { express: '5' } } }, ['package-lock.json']),
    want: { framework: Framework.Generic, dev: ['npm', 'run', 'start'], defaultPort: 3000, env: expect.objectContaining({ PORT: '4174' }) }
  },
  {
    name: 'no framework: serve when there is no dev or start',
    facts: repo({ 'package.json': { scripts: { serve: 'http-server .' } } }),
    want: { framework: Framework.Generic, dev: ['npm', 'run', 'serve'] }
  },
  {
    name: 'a package.json only in a subfolder, outside any workspace',
    facts: repo({ 'web/package.json': { scripts: { dev: 'vite' }, devDependencies: { vite: '6' } } }, ['web/pnpm-lock.yaml']),
    want: { appDir: 'web', installDir: 'web', manager: Manager.Pnpm }
  },
  {
    name: 'an app chosen among several',
    facts: TWO_APPS,
    app: 'apps/docs',
    want: { framework: Framework.Astro, appDir: 'apps/docs', installDir: '' }
  },
  {
    name: 'a path inside an app picks the app around it',
    facts: TWO_APPS,
    app: 'apps/web/src/app',
    want: { framework: Framework.Next, appDir: 'apps/web' }
  }
];

describe('runPlan', () => {
  it.each(PLANS)('$name', ({ facts, app, want }) => {
    expect(runPlan(facts, app ?? null, SANDBOX)).toMatchObject({ ok: true, ...want });
  });

  it('a local folder listens on loopback, and a framework without flags gets none', () => {
    const vite = repo({ 'package.json': { scripts: { dev: 'vite' }, devDependencies: { vite: '6' } } });
    const plain = repo({ 'package.json': { scripts: { dev: 'node server.js' } } });

    expect(runPlan(vite, null, LOOPBACK)).toMatchObject({ dev: ['npm', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '51234', '--strictPort'] });
    expect(runPlan(plain, null, LOOPBACK)).toMatchObject({ dev: ['npm', 'run', 'dev'], env: expect.objectContaining({ PORT: '51234', HOST: '127.0.0.1' }) });
  });
});

describe('runPlan refusals', () => {
  it('several apps and none chosen: the list, so the user can pick', () => {
    expect(runPlan(TWO_APPS, null, SANDBOX)).toMatchObject({ ok: false, refusal: PlanRefusal.ChooseApp, apps: ['apps/docs', 'apps/web'] });
  });

  it('no package.json anywhere', () => {
    expect(runPlan(repo({ 'README.md': 'hi' }), null, SANDBOX)).toMatchObject({ ok: false, refusal: PlanRefusal.NoPackage });
  });

  it('a chosen app with no package.json around it', () => {
    expect(runPlan(TWO_APPS, 'apps/missing', SANDBOX)).toMatchObject({ ok: false, refusal: PlanRefusal.NoPackage, apps: ['apps/docs', 'apps/web'] });
  });

  it('Next with only next start: a production server needs a build, so no script runs', () => {
    const facts = repo({ 'package.json': { scripts: { start: 'next start' }, dependencies: { next: '15' } } });

    expect(runPlan(facts, null, SANDBOX)).toMatchObject({ ok: false, refusal: PlanRefusal.NoScript, reason: expect.stringContaining('dev') });
  });
});

describe('Node version', () => {
  const withNode = (texts: Texts) => runPlan(repo({ 'package.json': { scripts: { dev: 'vite' }, devDependencies: { vite: '6' } }, ...texts }), null, SANDBOX);

  it.each([
    [{}, NodeLine.Node24],
    [{ '.nvmrc': 'v18.19.0' }, NodeLine.Node22],
    [{ '.nvmrc': 'lts/iron' }, NodeLine.Node22],
    [{ '.nvmrc': 'lts/*' }, NodeLine.Node24],
    [{ '.node-version': '24.1.0' }, NodeLine.Node24],
    [{ '.nvmrc': '26' }, NodeLine.Node26],
    [{ '.nvmrc': 'garbage' }, NodeLine.Node24]
  ])('%j → %s', (texts, line) => {
    expect(withNode(texts)).toMatchObject({ node: line });
  });

  it('engines.node when no version file', () => {
    const facts = repo({ 'package.json': { engines: { node: '>=18.17' }, scripts: { dev: 'vite' }, devDependencies: { vite: '6' } } });

    expect(runPlan(facts, null, SANDBOX)).toMatchObject({ node: NodeLine.Node22 });
  });
});

describe('appOf', () => {
  it('normalises a relative folder and refuses escapes', () => {
    expect(appOf('./apps/web/')).toBe('apps/web');
    expect(appOf('apps/v4')).toBe('apps/v4');
    expect(appOf('')).toBeNull();
    expect(appOf('../etc')).toBeNull();
    expect(appOf('/abs')).toBeNull();
    expect(appOf('a;rm -rf')).toBeNull();
  });
});

describe('the files a plan reads', () => {
  it('lists package manifests, lockfiles, configs and version files, not sources', () => {
    expect(['package.json', 'apps/v4/next.config.mjs', 'pnpm-lock.yaml', '.nvmrc', 'angular.json', '.yarnrc.yml'].every(planFile)).toBe(true);
    expect(['src/App.tsx', 'README.md'].some(planFile)).toBe(false);
  });

  it('reads the manifests and version files only', () => {
    expect(textsWanted(['package.json', 'pnpm-lock.yaml', 'apps/web/package.json', '.nvmrc', 'next.config.ts'])).toEqual(['package.json', 'apps/web/package.json', '.nvmrc']);
  });
});
