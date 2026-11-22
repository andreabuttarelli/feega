import { describe, expect, it } from 'vitest';
import { addImport, importLine, relativeImport } from './add-import';

const LINE = "import Scene from './Scene.svelte';";

describe('relativeImport', () => {
  it.each([
    ['src/routes/+page.svelte', 'src/lib/Scene.svelte', '../lib/Scene.svelte'],
    ['src/App.tsx', 'src/components/Scene.tsx', './components/Scene'],
    ['src/pages/index.astro', 'src/components/Scene.astro', '../components/Scene.astro'],
    ['App.vue', 'src/Scene.vue', './src/Scene.vue'],
    ['src/a/b/Page.tsx', 'src/a/Scene.jsx', '../Scene']
  ])('%s -> %s', (from, to, expected) => {
    expect(relativeImport(from, to)).toBe(expected);
  });
});

describe('importLine', () => {
  it('names the component by its default export', () => {
    expect(importLine('Scene3D', '../lib/Scene3D.svelte')).toBe("import Scene3D from '../lib/Scene3D.svelte';");
  });
});

describe('addImport', () => {
  it('adds to an existing svelte script after its last import', () => {
    const source = "<script>\n  import a from 'a';\n  let x = 1;\n</script>\n\n<div></div>\n";
    const out = addImport('P.svelte', source, LINE);
    expect(out).toEqual({ ok: true, after: "<script>\n  import a from 'a';\n  import Scene from './Scene.svelte';\n  let x = 1;\n</script>\n\n<div></div>\n" });
  });

  it('adds right after the opening tag when the script has no imports', () => {
    const out = addImport('P.svelte', '<script lang="ts">\n  let x = 1;\n</script>\n<div></div>', LINE);
    expect(out).toEqual({ ok: true, after: '<script lang="ts">\n  import Scene from \'./Scene.svelte\';\n  let x = 1;\n</script>\n<div></div>' });
  });

  it('creates a script block when the file has none', () => {
    const out = addImport('P.svelte', '<div></div>\n', LINE);
    expect(out).toEqual({ ok: true, after: "<script>\n  import Scene from './Scene.svelte';\n</script>\n\n<div></div>\n" });
  });

  it('skips a svelte module script', () => {
    const source = "<script module>\n  export const x = 1;\n</script>\n<script>\n  let y = 2;\n</script>\n";
    const out = addImport('P.svelte', source, LINE);
    expect(out.ok && out.after).toContain("<script>\n  import Scene from './Scene.svelte';\n  let y = 2;");
  });

  it('prefers script setup in vue', () => {
    const out = addImport('P.vue', "<template><div /></template>\n<script setup>\nimport a from 'a';\n</script>\n", LINE);
    expect(out.ok && out.after).toContain("import a from 'a';\nimport Scene from './Scene.svelte';\n</script>");
  });

  it('creates script setup in a vue file with only a template', () => {
    const out = addImport('P.vue', '<template><div /></template>\n', LINE);
    expect(out.ok && out.after).toBe("<script setup>\nimport Scene from './Scene.svelte';\n</script>\n\n<template><div /></template>\n");
  });

  it('refuses a vue file whose only script is the options api', () => {
    const out = addImport('P.vue', '<script>\nexport default {}\n</script>\n<template><div /></template>', LINE);
    expect(out.ok).toBe(false);
  });

  it('adds to astro frontmatter', () => {
    const out = addImport('P.astro', "---\nimport L from './L.astro';\nconst a = 1;\n---\n<div />\n", LINE);
    expect(out.ok && out.after).toBe("---\nimport L from './L.astro';\nimport Scene from './Scene.svelte';\nconst a = 1;\n---\n<div />\n");
  });

  it('creates frontmatter in an astro file with none', () => {
    const out = addImport('P.astro', '<div />\n', LINE);
    expect(out.ok && out.after).toBe("---\nimport Scene from './Scene.svelte';\n---\n<div />\n");
  });

  it('adds after the last import of a tsx file, even a multi-line one', () => {
    const source = "import { a,\n  b } from 'x';\nimport c from 'c';\n\nexport default function P() {\n  return <div />;\n}\n";
    const out = addImport('P.tsx', source, LINE);
    expect(out.ok && out.after).toBe("import { a,\n  b } from 'x';\nimport c from 'c';\nimport Scene from './Scene.svelte';\n\nexport default function P() {\n  return <div />;\n}\n");
  });

  it('keeps a use client directive on top', () => {
    const out = addImport('P.tsx', "'use client';\n\nexport default function P() {\n  return <div />;\n}\n", LINE);
    expect(out.ok && out.after.startsWith("'use client';\n")).toBe(true);
    expect(out.ok && out.after).toContain("import Scene from './Scene.svelte';");
  });

  it('is idempotent', () => {
    const once = addImport('P.tsx', 'export const a = 1;\n', LINE);
    expect(once.ok && addImport('P.tsx', once.after, LINE)).toEqual(once);
  });

  it('refuses a file type it does not know', () => {
    expect(addImport('P.html', '<div></div>', LINE).ok).toBe(false);
  });
});
