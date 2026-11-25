import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../../packages/library/src/catalog';
import { Step, scaffoldProject, type ScaffoldPorts } from './scaffold';
import { Stack } from './stacks';
import { Template } from './templates';

const catalog = buildCatalog();

const fakePorts = (taken: string[] = []) => {
  const written: Record<string, string> = {};
  const installs: string[] = [];
  const ports: ScaffoldPorts = {
    occupied: async (dir) => taken.includes(dir),
    write: async (dir, files) => void Object.assign(written, Object.fromEntries(Object.entries(files).map(([name, text]) => [`${dir}/${name}`, text]))),
    install: async (dir, onLine) => (installs.push(dir), onLine('added 10 packages'))
  };
  return { ports, written, installs };
};

const ask = { parent: '/work', name: 'Shop Front', template: Template.Blank, catalog };

describe('scaffoldProject', () => {
  it('writes files, wires the plugin and installs, in that order', async () => {
    const { ports, written, installs } = fakePorts();
    const steps: Step[] = [];

    const out = await scaffoldProject({ ...ask, stack: Stack.ReactVite }, ports, (step, line) => line === undefined && steps.push(step));

    expect(out).toEqual({ ok: true, dir: '/work/shop-front' });
    expect(written['/work/shop-front/vite.config.ts']).toContain('feegaSource');
    expect(JSON.parse(written['/work/shop-front/package.json']).devDependencies['feega-source-map']).toBeDefined();
    expect(installs).toEqual(['/work/shop-front']);
    expect(steps).toEqual([Step.Files, Step.Plugin, Step.Install, Step.Done]);
  });

  it('skips the plugin for stacks the launcher maps itself', async () => {
    const { ports, written } = fakePorts();
    const steps: Step[] = [];

    await scaffoldProject({ ...ask, stack: Stack.Astro }, ports, (step, line) => line === undefined && steps.push(step));

    expect(written['/work/shop-front/package.json']).not.toContain('feega-source-map');
    expect(steps).not.toContain(Step.Plugin);
  });

  it('refuses a folder that already has files', async () => {
    const { ports, installs } = fakePorts(['/work/shop-front']);

    const out = await scaffoldProject({ ...ask, stack: Stack.Next }, ports, () => undefined);

    expect(out).toMatchObject({ ok: false });
    expect(installs).toEqual([]);
  });

  it('reports an install failure', async () => {
    const { ports } = fakePorts();
    ports.install = async () => Promise.reject(new Error('Could not reach npm.'));

    const out = await scaffoldProject({ ...ask, stack: Stack.Nuxt }, ports, () => undefined);

    expect(out).toEqual({ ok: false, reason: 'Could not reach npm.' });
  });
});
