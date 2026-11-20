import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { arbitraryFamily, LiveProp } from '@feega/live-edit/live-fields';
import { fileEdits } from './file-edits';

const TAILWIND = JSON.stringify({ devDependencies: { tailwindcss: '^4.0.0' } });
const PLAIN = JSON.stringify({ devDependencies: { vite: '^5.0.0' } });
const IMAGE = 'bg-[url(/images/x.jpg)]';
const GRADIENT_CSS = 'linear-gradient(90deg, red 0%, blue 100%)';

const SVELTE = `<section>
  <h1 class="title">Hello</h1>
</section>
`;

const VUE = `<template>
  <h1 class="title">Hello</h1>
</template>
`;

const JSX = `import styles from './Hero.module.css';

export function Hero() {
  return <h1 className={styles.title}>Hello</h1>;
}
`;

function app(manifest: string, file: string, text: string) {
  const root = mkdtempSync(join(tmpdir(), 'feega-fill-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), manifest);
  writeFileSync(join(root, file), text);
  return root;
}

const read = (root: string, file: string) => readFileSync(join(root, file), 'utf8');

const TEXT_GRADIENT = { 'background-image': GRADIENT_CSS, '-webkit-background-clip': 'text', 'background-clip': 'text', color: 'transparent' };
const TEXT_PLAIN = { 'background-image': '', '-webkit-background-clip': '', 'background-clip': '', color: 'red' };

describe('image fill writers', () => {
  it('tailwind writes bg-[url()] and a new image replaces it', async () => {
    const root = app(TAILWIND, 'src/Page.svelte', SVELTE);
    const edits = fileEdits(root);
    const at = 'src/Page.svelte:2:3';

    await edits.edit({ at, prop: LiveProp.Class, family: arbitraryFamily('background-image'), value: IMAGE, css: {} });
    expect(read(root, 'src/Page.svelte')).toContain(`class="title ${IMAGE}"`);

    await edits.edit({ at, prop: LiveProp.Class, family: arbitraryFamily('background-image'), value: `[background-image:${GRADIENT_CSS.replace(/,\s+/g, ',').replace(/\s+/g, '_')}]`, css: {} });
    expect(read(root, 'src/Page.svelte')).not.toContain(IMAGE);
  });

  it('tailwind writes size, repeat and position as arbitrary properties', async () => {
    const root = app(TAILWIND, 'src/Page.svelte', SVELTE);
    const edits = fileEdits(root);
    const at = 'src/Page.svelte:2:3';

    await edits.edit({ at, prop: LiveProp.Class, family: arbitraryFamily('background-size'), value: '[background-size:cover]', css: {} });
    await edits.edit({ at, prop: LiveProp.Class, family: arbitraryFamily('background-position'), value: '[background-position:50%_50%]', css: {} });

    expect(read(root, 'src/Page.svelte')).toContain('[background-size:cover]');
    expect(read(root, 'src/Page.svelte')).toContain('[background-position:50%_50%]');
  });

  it('svelte scoped css writes the image and its placement; undo removes them', async () => {
    const root = app(PLAIN, 'src/Page.svelte', SVELTE);
    const edits = fileEdits(root);
    const css = { 'background-image': 'url("/images/x.jpg")', 'background-size': 'cover', 'background-repeat': 'no-repeat', 'background-position': '50% 50%' };

    await edits.edit({ at: 'src/Page.svelte:2:3', prop: LiveProp.Class, value: '', css });
    const written = read(root, 'src/Page.svelte');
    await edits.undo();

    expect(written).toContain('background-image: url("/images/x.jpg")');
    expect(written).toContain('background-size: cover');
    expect(read(root, 'src/Page.svelte')).toBe(SVELTE);
  });

  it('vue scoped css writes the image into the scoped style', async () => {
    const root = app(PLAIN, 'src/Page.vue', VUE);

    await fileEdits(root).edit({ at: 'src/Page.vue:2:3', prop: LiveProp.Class, value: '', css: { 'background-image': 'url("/images/x.jpg")' } });

    expect(read(root, 'src/Page.vue')).toMatch(/<style>[\s\S]*background-image: url\("\/images\/x.jpg"\)/);
  });

  it('a css module gets the image in its stylesheet', async () => {
    const root = app(PLAIN, 'src/Hero.jsx', JSX);
    writeFileSync(join(root, 'src/Hero.module.css'), '.title {\n  margin: 0;\n}\n');

    await fileEdits(root).edit({ at: 'src/Hero.jsx:4:10', prop: LiveProp.Class, value: '', css: { 'background-image': 'url("/images/x.jpg")' } });

    expect(read(root, 'src/Hero.module.css')).toContain('background-image: url("/images/x.jpg")');
  });
});

describe('text gradient writers', () => {
  it('svelte scoped css writes the layers, both clips and a transparent colour; removing drops the clip and restores the colour', async () => {
    const root = app(PLAIN, 'src/Page.svelte', SVELTE);
    const edits = fileEdits(root);
    const at = 'src/Page.svelte:2:3';

    await edits.edit({ at, prop: LiveProp.Class, value: '', css: TEXT_GRADIENT });
    const on = read(root, 'src/Page.svelte');
    await edits.edit({ at, prop: LiveProp.Class, value: '', css: TEXT_PLAIN });
    const off = read(root, 'src/Page.svelte');

    expect(on).toContain(`background-image: ${GRADIENT_CSS}`);
    expect(on).toContain('-webkit-background-clip: text');
    expect(on).toContain('background-clip: text');
    expect(on).toContain('color: transparent');
    expect(off).not.toContain('background-clip');
    expect(off).not.toContain('background-image');
    expect(off).toContain('color: red');
  });

  it('vue scoped css writes the clip', async () => {
    const root = app(PLAIN, 'src/Page.vue', VUE);

    await fileEdits(root).edit({ at: 'src/Page.vue:2:3', prop: LiveProp.Class, value: '', css: TEXT_GRADIENT });

    expect(read(root, 'src/Page.vue')).toMatch(/<style>[\s\S]*-webkit-background-clip: text/);
  });

  it('a css module writes the clip into its stylesheet and removes it again', async () => {
    const root = app(PLAIN, 'src/Hero.jsx', JSX);
    writeFileSync(join(root, 'src/Hero.module.css'), '.title {\n  color: red;\n}\n');
    const edits = fileEdits(root);
    const at = 'src/Hero.jsx:4:10';

    await edits.edit({ at, prop: LiveProp.Class, value: '', css: TEXT_GRADIENT });
    const on = read(root, 'src/Hero.module.css');
    await edits.edit({ at, prop: LiveProp.Class, value: '', css: TEXT_PLAIN });

    expect(on).toContain('background-clip: text');
    expect(read(root, 'src/Hero.module.css')).toBe('.title {\n  color: red;\n}\n');
  });

  it('tailwind writes bg-clip-text and text-transparent, and removing drops the clip class', async () => {
    const root = app(TAILWIND, 'src/Page.svelte', SVELTE);
    const edits = fileEdits(root);
    const at = 'src/Page.svelte:2:3';

    await edits.edit({ at, prop: LiveProp.Class, family: arbitraryFamily('background-image'), value: `[background-image:${GRADIENT_CSS.replace(/,\s+/g, ',').replace(/\s+/g, '_')}]`, css: {} });
    await edits.edit({ at, prop: LiveProp.Class, family: arbitraryFamily('background-clip'), value: 'bg-clip-text', css: {} });
    await edits.edit({ at, prop: LiveProp.Color, value: 'transparent' });
    const on = read(root, 'src/Page.svelte');
    await edits.edit({ at, prop: LiveProp.Class, family: arbitraryFamily('background-clip'), value: '', css: {} });
    await edits.edit({ at, prop: LiveProp.Class, family: arbitraryFamily('background-image'), value: '', css: {} });
    await edits.edit({ at, prop: LiveProp.Color, value: '#ff0000' });

    expect(on).toContain('bg-clip-text');
    expect(on).toContain('text-transparent');
    expect(read(root, 'src/Page.svelte')).toContain('class="title text-[#ff0000]"');
  });
});
