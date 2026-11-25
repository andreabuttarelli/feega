import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../../packages/library/src/catalog';
import { layoutOf } from '@feega/live-edit/library-insert';
import { planInit } from '../init';
import { composeProject } from './compose';
import { STACKS, Stack } from './stacks';
import { TEMPLATES, Template } from './templates';

const catalog = buildCatalog();
const FREE = new Set(catalog.items.filter((item) => item.tier === 'free').map((item) => item.id));

describe('templates', () => {
  it('use only free library items that exist', () => {
    for (const sections of Object.values(TEMPLATES)) {
      for (const id of sections) {
        expect(FREE.has(id), id).toBe(true);
      }
    }
  });

  it('blank has no sections', () => {
    expect(TEMPLATES[Template.Blank]).toEqual([]);
  });
});

describe.each(Object.values(Stack))('composeProject %s', (stack) => {
  it('has a package.json the library recognises and a page file', async () => {
    const out = await composeProject({ stack, template: Template.Blank, name: 'My Site', catalog });

    expect(out.ok).toBe(true);
    if (!out.ok) {
      return;
    }
    expect(layoutOf(out.files['package.json'])).not.toBeNull();
    expect(JSON.parse(out.files['package.json']).name).toBe('my-site');
    expect(out.files[STACKS[stack].page]).toContain('My Site');
  });

  it.each([Template.Landing, Template.Portfolio, Template.Dashboard])('inserts the %s sections into the page', async (template) => {
    const out = await composeProject({ stack, template, name: 'demo', catalog });

    expect(out.ok).toBe(true);
    if (!out.ok) {
      return;
    }
    const written = Object.keys(out.files).filter((path) => path.includes('feega/'));
    expect(written.length).toBeGreaterThanOrEqual(TEMPLATES[template].length);
    for (const id of TEMPLATES[template]) {
      const component = catalog.items.find((item) => item.id === id)!.component;
      expect(out.files[STACKS[stack].page], id).toContain(component);
    }
  });
});

describe('plugin wiring', () => {
  it.each([Stack.ReactVite, Stack.Next, Stack.SvelteKit, Stack.VueVite])('%s accepts the feega init plan', async (stack) => {
    const out = await composeProject({ stack, template: Template.Blank, name: 'demo', catalog });
    if (!out.ok) {
      throw new Error(out.reason);
    }

    const plan = planInit(out.files);

    expect(Object.keys(plan.edits)).toContain('package.json');
    expect(Object.values(plan.edits).join('\n')).toContain('feega-source-map');
  });

  it('astro and nuxt need no plugin step', () => {
    expect(STACKS[Stack.Astro].plugin).toBe(false);
    expect(STACKS[Stack.Nuxt].plugin).toBe(false);
  });
});
