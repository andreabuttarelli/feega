import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { ICON_ATTR, SOURCE_ATTR } from './runtime.js';
import { mountOf, stampSources } from './framework-meta.js';

const docOf = (html: string) => new JSDOM(`<body>${html}</body>`).window.document;

describe('stampSources', () => {
  it('reads Svelte __svelte_meta (column is 0-based, tags are 1-based)', () => {
    const doc = docOf('<h1>a</h1>');
    (doc.querySelector('h1') as any).__svelte_meta = { loc: { file: 'src/A.svelte', line: 3, column: 4 } };
    stampSources(doc);
    expect(doc.querySelector('h1')!.getAttribute(SOURCE_ATTR)).toBe('src/A.svelte:3:5');
  });

  it('reads React 18 _debugSource', () => {
    const doc = docOf('<h1>a</h1>');
    (doc.querySelector('h1') as any).__reactFiber$x = { _debugSource: { fileName: '/app/A.tsx', lineNumber: 5, columnNumber: 7 } };
    stampSources(doc);
    expect(doc.querySelector('h1')!.getAttribute(SOURCE_ATTR)).toBe('/app/A.tsx:5:7');
  });

  it('reads React 19 _debugStack', () => {
    const doc = docOf('<h1>a</h1>');
    const stack = 'Error: react-stack-top-frame\n    at exports.jsxDEV (react-jsx-dev-runtime.js:10:5)\n    at A (http://localhost:3000/src/A.tsx:9:11)';
    (doc.querySelector('h1') as any).__reactFiber$x = { _debugStack: { stack } };
    stampSources(doc);
    expect(doc.querySelector('h1')!.getAttribute(SOURCE_ATTR)).toBe('/src/A.tsx:9:11');
  });

  it('reads Vue __file from the owning component', () => {
    const doc = docOf('<h1>a</h1>');
    (doc.querySelector('h1') as any).__vueParentComponent = { type: { __file: 'src/A.vue' } };
    stampSources(doc);
    expect(doc.querySelector('h1')!.getAttribute(SOURCE_ATTR)).toBe('src/A.vue:1:0');
  });

  it('keeps existing tags', () => {
    const doc = docOf(`<h1 ${SOURCE_ATTR}="x.tsx:1:1">a</h1>`);
    (doc.querySelector('h1') as any).__svelte_meta = { loc: { file: 'y', line: 1, column: 1 } };
    stampSources(doc);
    expect(doc.querySelector('h1')!.getAttribute(SOURCE_ATTR)).toBe('x.tsx:1:1');
  });

  it('leaves the insides of an icon component unpickable', () => {
    const doc = docOf(`<svg ${SOURCE_ATTR}="src/A.svelte:4:3" ${ICON_ATTR}="Heart"><path d="M0 0"/></svg>`);
    (doc.querySelector('path') as any).__svelte_meta = { loc: { file: 'node_modules/@lucide/svelte/dist/Icon.svelte', line: 20, column: 4 } };
    stampSources(doc);
    expect(doc.querySelector('path')!.hasAttribute(SOURCE_ATTR)).toBe(false);
  });
});

describe('mountOf', () => {
  it('mounts an element rendered by an Astro component, which has no props to read', () => {
    const doc = docOf(`<h1 ${SOURCE_ATTR}="src/Card.astro:4:3">a</h1>`);

    expect(mountOf(doc.querySelector('h1')!)).toEqual({ name: '', props: {} });
  });

  it('does not mount a plain element of a page', () => {
    expect(mountOf(docOf(`<h1 ${SOURCE_ATTR}="src/index.html:4:3">a</h1>`).querySelector('h1')!)).toBeNull();
  });
});
