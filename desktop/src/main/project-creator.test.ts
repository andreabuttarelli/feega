import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../../packages/library/src/catalog';
import { Step } from '../../../cli/lib/scaffold/step';
import { Stack } from '../../../cli/lib/scaffold/stacks';
import { Template } from '../../../cli/lib/scaffold/templates';
import { projectCreator, type ProjectProgress } from './project-creator';

const ports = (fail = false) => ({
  occupied: async () => false,
  write: async () => undefined,
  install: async (_dir: string, onLine: (line: string) => void) => (onLine('added 3 packages'), fail ? Promise.reject(new Error('npm install failed')) : undefined)
});

const ask = { parent: '/w', name: 'Demo', stack: Stack.SvelteKit, template: Template.Landing };

describe('projectCreator', () => {
  it('reports each step and the install output lines', async () => {
    const seen: ProjectProgress[] = [];

    const out = await projectCreator(async () => buildCatalog(), ports(), (p) => p && seen.push(p))(ask);

    expect(out).toEqual({ ok: true, dir: join('/w', 'demo') });
    expect(seen.map((p) => p.step)).toContain(Step.Install);
    expect(seen.some((p) => p.line === 'added 3 packages')).toBe(true);
  });

  it('returns the failure instead of throwing', async () => {
    const out = await projectCreator(async () => buildCatalog(), ports(true), () => undefined)(ask);

    expect(out).toEqual({ ok: false, reason: 'npm install failed' });
  });

  it('returns a missing library as a failure', async () => {
    const out = await projectCreator(async () => Promise.reject(new Error('library.json missing')), ports(), () => undefined)(ask);

    expect(out).toEqual({ ok: false, reason: 'library.json missing' });
  });
});
