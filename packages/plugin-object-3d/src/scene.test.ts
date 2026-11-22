import { describe, expect, it } from 'vitest';
import { Framework } from '@feega/plugin-api/protocol';
import { COMPONENT_NAME, DEFAULT_SCENE, RUNTIME_FILE, SCENE_DIR, attributeText, componentFor, sceneOf } from './scene';

describe('attributeText', () => {
  it('writes the scene as component attributes and skips empty ones', () => {
    expect(attributeText({ ...DEFAULT_SCENE, shape: 'sphere', model: '' })).toBe('shape="sphere" material="glass" lights="studio" autorotate="true" follow="true" color="#ff5a1f" text="Feega"');
  });

  it('includes the model and font when set', () => {
    const text = attributeText({ ...DEFAULT_SCENE, shape: 'model', model: '/models/a.glb' });
    expect(text).toContain('model="/models/a.glb"');
  });
});

describe('sceneOf', () => {
  it('reads the scene back from the rendered data attributes', () => {
    const scene = sceneOf([
      { name: 'data-feega-scene', value: 'torus' },
      { name: 'data-material', value: 'metal' },
      { name: 'data-lights', value: 'dramatic' },
      { name: 'data-autorotate', value: 'false' },
      { name: 'data-follow', value: 'true' },
      { name: 'data-color', value: '#00ff00' },
      { name: 'class', value: 'feega-scene' }
    ]);
    expect(scene).toMatchObject({ shape: 'torus', material: 'metal', lights: 'dramatic', autorotate: 'false', follow: 'true', color: '#00ff00' });
  });

  it('gives null when the element is not a scene', () => {
    expect(sceneOf([{ name: 'class', value: 'x' }])).toBeNull();
  });

  it('falls back to the defaults for what is missing', () => {
    expect(sceneOf([{ name: 'data-feega-scene', value: 'cube' }])).toEqual({ ...DEFAULT_SCENE, shape: 'cube' });
  });
});

describe('componentFor', () => {
  const cases: [Framework, boolean, string][] = [
    [Framework.Svelte, false, `${SCENE_DIR}/${COMPONENT_NAME}.svelte`],
    [Framework.Vue, true, `${SCENE_DIR}/${COMPONENT_NAME}.vue`],
    [Framework.Astro, true, `${SCENE_DIR}/${COMPONENT_NAME}.astro`],
    [Framework.React, true, `${SCENE_DIR}/${COMPONENT_NAME}.tsx`],
    [Framework.React, false, `${SCENE_DIR}/${COMPONENT_NAME}.jsx`]
  ];

  it.each(cases)('%s (typescript %s) goes to %s', (framework, typescript, file) => {
    expect(componentFor(framework, typescript).file).toBe(file);
  });

  it.each(Object.values(Framework))('%s mounts the runtime and shows the data attributes the plugin reads back', (framework) => {
    const { source } = componentFor(framework, true);
    expect(source).toContain('mountScene');
    expect(source).toContain('./mount-scene');
    expect(source).toContain('data-feega-scene');
    for (const attribute of ['data-material', 'data-lights', 'data-autorotate', 'data-follow', 'data-color']) {
      expect(source).toContain(attribute);
    }
  });

  it('keeps the next.js client directive on top of the react component', () => {
    expect(componentFor(Framework.React, true).source.startsWith("'use client';")).toBe(true);
  });

  it('has no type annotations in the javascript variants', () => {
    expect(componentFor(Framework.React, false).source).not.toMatch(/: (React|HTML|Props|Scene)/);
    expect(componentFor(Framework.Vue, false).source).not.toContain('lang="ts"');
    expect(componentFor(Framework.Vue, true).source).toContain('lang="ts"');
  });

  it('never names the runtime like the component, which a case-insensitive disk would confuse', () => {
    const runtime = RUNTIME_FILE.split('/').pop()!.replace(/\.[^.]+$/, '').toLowerCase();
    expect(runtime).not.toBe(COMPONENT_NAME.toLowerCase());
  });

  it('names the runtime file next to the component', () => {
    expect(RUNTIME_FILE).toBe(`${SCENE_DIR}/mount-scene.ts`);
  });

  it('uses runes in the svelte component, which also runs in runes-mode projects', () => {
    const { source } = componentFor(Framework.Svelte, false);
    expect(source).toContain('$props()');
    expect(source).not.toContain('export let');
    expect(source).not.toMatch(/^\s*\$:/m);
  });

  it.each(Object.values(Framework))('%s sizes by aspect ratio unless a height is given', (framework) => {
    const { source } = componentFor(framework, true);
    expect(source).toMatch(/aspect-?[rR]atio/);
    expect(source).toContain('height');
    expect(source).not.toContain('360');
  });

  it('reads the height back from the page', () => {
    expect(sceneOf([{ name: 'data-feega-scene', value: 'cube' }, { name: 'data-height', value: '420' }])?.height).toBe('420');
    expect(DEFAULT_SCENE.height).toBe('');
  });
});
