import { dirname, join } from 'node:path';
import { Framework } from '@feega/dev-run/run-plan';

export type Exists = (path: string) => Promise<boolean>;

const FRAMEWORK_BIN: Record<Framework, string | null> = {
  [Framework.SvelteKit]: 'vite',
  [Framework.Vite]: 'vite',
  [Framework.ReactRouter]: 'react-router',
  [Framework.Nuxt]: 'nuxt',
  [Framework.Astro]: 'astro',
  [Framework.Next]: 'next',
  [Framework.Gatsby]: 'gatsby',
  [Framework.Angular]: 'ng',
  [Framework.Cra]: 'react-scripts',
  [Framework.Generic]: null
};

export async function depsMissing(appRoot: string, workspace: string, framework: Framework, has: Exists): Promise<boolean> {
  const bin = FRAMEWORK_BIN[framework];
  if (!bin) {
    return !(await has(join(appRoot, 'node_modules')));
  }
  for (let dir = appRoot; dir.startsWith(workspace); dir = dirname(dir)) {
    if (await has(join(dir, 'node_modules', '.bin', bin))) {
      return false;
    }
    if (dir === workspace) {
      break;
    }
  }
  return true;
}

export enum DepsOutcome {
  Ready = 'ready',
  Installed = 'installed',
  Cancelled = 'cancelled',
  Failed = 'failed'
}

export type DepsSteps = { missing: () => Promise<boolean>; install: () => Promise<DepsOutcome> };

export async function ensureDeps(steps: DepsSteps): Promise<DepsOutcome> {
  return (await steps.missing()) ? steps.install() : DepsOutcome.Ready;
}
