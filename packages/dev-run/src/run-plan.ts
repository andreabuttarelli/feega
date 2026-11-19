export enum Framework {
  SvelteKit = 'sveltekit',
  Nuxt = 'nuxt',
  Astro = 'astro',
  ReactRouter = 'react-router',
  Next = 'next',
  Gatsby = 'gatsby',
  Angular = 'angular',
  Cra = 'cra',
  Vite = 'vite',
  Generic = 'generic'
}

export enum Manager {
  Npm = 'npm',
  Pnpm = 'pnpm',
  Yarn = 'yarn',
  YarnBerry = 'yarn-berry',
  Bun = 'bun'
}

export enum NodeLine {
  Node22 = '22',
  Node24 = '24',
  Node26 = '26'
}

export enum PlanRefusal {
  NoPackage = 'no_package',
  NoScript = 'no_script',
  ChooseApp = 'choose_app'
}

export type RepoFacts = { files: readonly string[]; texts: Readonly<Record<string, string>> };

export type Listen = { host: string; port: number };

export type RunPlan = { ok: true; framework: Framework; manager: Manager; appDir: string; installDir: string; install: string[]; dev: string[]; env: Record<string, string>; node: NodeLine; port: number; defaultPort: number };

export type PlanRefused = { ok: false; refusal: PlanRefusal; reason: string; apps: string[] };

export type Planned = RunPlan | PlanRefused;

type Manifest = {
  packageManager?: string;
  workspaces?: unknown;
  engines?: { node?: string };
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type Flags = (listen: Listen) => string[];

const VITE_FLAGS: Flags = (l) => ['--host', l.host, '--port', String(l.port), '--strictPort'];
const PORT_HOST_FLAGS: Flags = (l) => ['--port', String(l.port), '--host', l.host];
const SHORT_FLAGS: Flags = (l) => ['-H', l.host, '-p', String(l.port)];
const NO_FLAGS: Flags = () => [];

const DEV_SCRIPTS = ['dev', 'start', 'serve'];

type FrameworkRow = { needs: string[][]; config: RegExp | null; scripts: string[]; flags: Flags; port: number };

const FRAMEWORKS: Record<Framework, FrameworkRow> = {
  [Framework.SvelteKit]: { needs: [['@sveltejs/kit']], config: null, scripts: ['dev'], flags: VITE_FLAGS, port: 5173 },
  [Framework.Nuxt]: { needs: [['nuxt']], config: /^nuxt\.config\.[cm]?[jt]s$/, scripts: ['dev'], flags: PORT_HOST_FLAGS, port: 3000 },
  [Framework.Astro]: { needs: [['astro']], config: /^astro\.config\.[cm]?[jt]s$/, scripts: ['dev', 'start'], flags: PORT_HOST_FLAGS, port: 4321 },
  [Framework.ReactRouter]: { needs: [['@react-router/dev'], ['@remix-run/dev', 'vite']], config: /^react-router\.config\.[cm]?[jt]s$/, scripts: ['dev'], flags: VITE_FLAGS, port: 5173 },
  [Framework.Next]: { needs: [['next']], config: /^next\.config\.[cm]?[jt]s$/, scripts: ['dev'], flags: SHORT_FLAGS, port: 3000 },
  [Framework.Gatsby]: { needs: [['gatsby']], config: /^gatsby-config\.[cm]?[jt]s$/, scripts: ['develop', 'dev', 'start'], flags: SHORT_FLAGS, port: 8000 },
  [Framework.Angular]: { needs: [['@angular/cli']], config: /^angular\.json$/, scripts: ['start', 'dev'], flags: PORT_HOST_FLAGS, port: 4200 },
  [Framework.Cra]: { needs: [['react-scripts']], config: null, scripts: ['start', 'dev'], flags: NO_FLAGS, port: 3000 },
  [Framework.Vite]: { needs: [['vite']], config: /^vite\.config\.[cm]?[jt]s$/, scripts: ['dev', 'start'], flags: VITE_FLAGS, port: 5173 },
  [Framework.Generic]: { needs: [], config: null, scripts: DEV_SCRIPTS, flags: NO_FLAGS, port: 3000 }
};

type ManagerRow = { lockfiles: string[]; bin: (version: string | null) => string[]; install: string[]; separator: string[]; env: Record<string, string>; node: NodeLine | null };

const MANAGERS: Record<Manager, ManagerRow> = {
  [Manager.Pnpm]: { lockfiles: ['pnpm-lock.yaml'], bin: (v) => (v ? ['npx', '-y', `pnpm@${v}`] : ['pnpm']), install: ['install', '--reporter=append-only', '--config.strict-dep-builds=false'], separator: [], env: {}, node: null },
  [Manager.Yarn]: { lockfiles: ['yarn.lock'], bin: (v) => ['npx', '-y', `yarn@${v ?? '1'}`], install: ['install', '--non-interactive', '--silent'], separator: [], env: {}, node: null },
  [Manager.YarnBerry]: { lockfiles: [], bin: (v) => ['npx', '-y', '-p', `@yarnpkg/cli-dist@${v ?? 'latest'}`, 'yarn'], install: ['install'], separator: [], env: { YARN_ENABLE_IMMUTABLE_INSTALLS: 'false' }, node: null },
  [Manager.Bun]: { lockfiles: ['bun.lock', 'bun.lockb'], bin: (v) => (v ? ['npx', '-y', `bun@${v}`] : ['bun']), install: ['install'], separator: [], env: {}, node: NodeLine.Node24 },
  [Manager.Npm]: { lockfiles: ['package-lock.json'], bin: () => ['npm'], install: ['install', '--no-audit', '--no-fund', '--loglevel=error'], separator: ['--'], env: {}, node: null }
};

const BERRY_MARKER = '.yarnrc.yml';
const FIRST_BERRY_MAJOR = 2;
const PINNED = /^(npm|pnpm|yarn|bun)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)/;

const LTS_MAJOR: Record<string, number> = { hydrogen: 18, iron: 20, jod: 22, krypton: 24 };
const LTS_NAME = /^lts\/([a-z]+)$/;
const MAJOR = /\d+/;
const NODE_LINES: [number, NodeLine][] = [
  [22, NodeLine.Node22],
  [24, NodeLine.Node24]
];
const DEFAULT_NODE = NodeLine.Node24;
const NEWEST_NODE = NodeLine.Node26;

const MANIFEST = 'package.json';
const VERSION_FILES = ['.nvmrc', '.node-version'];
const WORKSPACE_MARKERS = ['pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'lerna.json'];
const PLAN_NAMES = new Set([MANIFEST, BERRY_MARKER, ...VERSION_FILES, ...WORKSPACE_MARKERS, ...Object.values(MANAGERS).flatMap((m) => m.lockfiles)]);
const SKIPPED = /(^|\/)(node_modules|\.git)\//;
const MAX_MANIFESTS = 400;

const APP_PATH = /^[A-Za-z0-9._@-]+(\/[A-Za-z0-9._@-]+)*$/;
const MAX_APP_PATH = 200;

const baseOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const inDir = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);

export const planFile = (path: string): boolean => !SKIPPED.test(path) && (PLAN_NAMES.has(baseOf(path)) || Object.values(FRAMEWORKS).some((f) => f.config?.test(baseOf(path))));

export const textsWanted = (files: readonly string[]): string[] => files.filter((f) => !SKIPPED.test(f) && (baseOf(f) === MANIFEST || VERSION_FILES.includes(baseOf(f)))).slice(0, MAX_MANIFESTS);

export function appOf(raw: string): string | null {
  const path = raw.trim().replace(/^\.\//, '').replace(/\/+$/, '');
  if (!path || path.length > MAX_APP_PATH || !APP_PATH.test(path)) {
    return null;
  }
  return path.split('/').some((s) => s === '..' || s === '.') ? null : path;
}

function manifestsOf(facts: RepoFacts): Map<string, Manifest> {
  const found = new Map<string, Manifest>();
  for (const path of facts.files) {
    if (baseOf(path) !== MANIFEST || SKIPPED.test(path) || facts.texts[path] === undefined) {
      continue;
    }
    try {
      found.set(dirOf(path), JSON.parse(facts.texts[path]) as Manifest);
    } catch {
      continue;
    }
  }
  return found;
}

const namesIn = (files: readonly string[], dir: string) => new Set(files.filter((f) => dirOf(f) === dir).map(baseOf));

function frameworkOf(manifest: Manifest, names: Set<string>): Framework {
  const deps = new Set(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }));
  const found = Object.entries(FRAMEWORKS).find(([, row]) => row.needs.some((all) => all.every((d) => deps.has(d))) || [...names].some((n) => row.config?.test(n)));
  return (found?.[0] as Framework | undefined) ?? Framework.Generic;
}

const scriptOf = (manifest: Manifest, framework: Framework) => FRAMEWORKS[framework].scripts.find((s) => manifest.scripts?.[s]) ?? null;

function appsOf(facts: RepoFacts, manifests: Map<string, Manifest>): string[] {
  return [...manifests]
    .filter(([dir, manifest]) => {
      const framework = frameworkOf(manifest, namesIn(facts.files, dir));
      return dir !== '' && framework !== Framework.Generic && scriptOf(manifest, framework) !== null;
    })
    .map(([dir]) => dir)
    .sort();
}

const refused = (refusal: PlanRefusal, reason: string, apps: string[]): PlanRefused => ({ ok: false, refusal, reason, apps });

function isWorkspace(facts: RepoFacts, root: Manifest | undefined): boolean {
  return Boolean(root?.workspaces) || WORKSPACE_MARKERS.some((m) => facts.files.includes(m));
}

function appDirOf(manifests: Map<string, Manifest>, apps: string[], asked: string | null, rootPlans: boolean): string | PlanRefused {
  if (asked !== null) {
    const segments = asked.split('/');
    const found = segments.map((_, i) => segments.slice(0, segments.length - i).join('/')).find((dir) => manifests.has(dir));
    return found ?? (rootPlans ? '' : refused(PlanRefusal.NoPackage, `no package.json in ${asked} or the folders above it`, apps));
  }
  if (rootPlans) {
    return '';
  }
  if (apps.length > 1) {
    return refused(PlanRefusal.ChooseApp, `this repository holds ${apps.length} apps: choose one`, apps);
  }
  if (apps.length === 1) {
    return apps[0];
  }
  const any = [...manifests.keys()].sort();
  return any.length === 1 ? any[0] : refused(PlanRefusal.NoPackage, any.length ? 'no folder of this repository holds an app with a dev server' : 'no package.json in this repository', any);
}

function managerOf(names: Set<string>, manifest: Manifest | undefined): { manager: Manager; version: string | null } {
  const pinned = manifest?.packageManager?.match(PINNED);
  if (pinned) {
    const berry = pinned[1] === Manager.Yarn && Number(pinned[2].split('.')[0]) >= FIRST_BERRY_MAJOR;
    return { manager: berry ? Manager.YarnBerry : (pinned[1] as Manager), version: pinned[2] };
  }
  const locked = (Object.entries(MANAGERS) as [Manager, ManagerRow][]).find(([, row]) => row.lockfiles.some((l) => names.has(l)))?.[0] ?? Manager.Npm;
  return { manager: locked === Manager.Yarn && names.has(BERRY_MARKER) ? Manager.YarnBerry : locked, version: null };
}

function majorOf(raw: string | undefined): number | null {
  const text = raw?.trim().toLowerCase() ?? '';
  const lts = text.match(LTS_NAME)?.[1];
  if (lts) {
    return LTS_MAJOR[lts] ?? null;
  }
  const major = text.match(MAJOR)?.[0];
  return major ? Number(major) : null;
}

function nodeOf(facts: RepoFacts, manifests: Map<string, Manifest>, dirs: string[]): NodeLine {
  const declared = [...dirs.flatMap((d) => VERSION_FILES.map((f) => facts.texts[inDir(d, f)])), ...dirs.map((d) => manifests.get(d)?.engines?.node)];
  const major = declared.map(majorOf).find((m) => m !== null);
  if (major === undefined || major === null) {
    return DEFAULT_NODE;
  }
  return NODE_LINES.find(([upTo]) => major <= upTo)?.[1] ?? NEWEST_NODE;
}

export function runPlan(facts: RepoFacts, asked: string | null, listen: Listen): Planned {
  const manifests = manifestsOf(facts);
  const root = manifests.get('');
  const workspace = isWorkspace(facts, root);
  const apps = appsOf(facts, manifests);
  const appDir = appDirOf(manifests, apps, asked, root !== undefined && !(workspace && apps.length > 0));
  if (typeof appDir !== 'string') {
    return appDir;
  }

  const manifest = manifests.get(appDir)!;
  const framework = frameworkOf(manifest, namesIn(facts.files, appDir));
  const row = FRAMEWORKS[framework];
  const script = scriptOf(manifest, framework);
  if (!script) {
    return refused(PlanRefusal.NoScript, `${appDir || 'the repository root'} has no ${row.scripts.join(' or ')} script in package.json`, apps);
  }

  const installDir = workspace && root ? '' : appDir;
  const { manager, version } = managerOf(namesIn(facts.files, installDir), manifests.get(installDir) ?? manifest);
  const pm = MANAGERS[manager];
  const bin = pm.bin(version);
  const flags = row.flags(listen);

  return {
    ok: true,
    framework,
    manager,
    appDir,
    installDir,
    install: [...bin, ...pm.install],
    dev: [...bin, 'run', script, ...(flags.length ? [...pm.separator, ...flags] : [])],
    env: { PORT: String(listen.port), HOST: listen.host, BROWSER: 'none', ...pm.env },
    node: pm.node ?? nodeOf(facts, manifests, [...new Set([appDir, installDir])]),
    port: listen.port,
    defaultPort: row.port
  };
}
