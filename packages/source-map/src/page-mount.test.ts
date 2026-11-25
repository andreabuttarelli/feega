import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { PropKind } from './component-props.ts';
import { SOURCE_ATTR } from './runtime.js';
import { controlsOfProps, startPageMount, webpackModules } from './page-mount.js';
import { pageMountUrl, requestOfHash } from './page-mount-url.js';

const NESTED_HOST = Symbol.for('feega.nested-host');
const SOURCE = 'app/Card.tsx:2:10';
const REQUEST = { file: 'app/Card.tsx', name: 'Card', props: { label: 'Hi' }, source: SOURCE, index: 0 };

describe('pageMountUrl', () => {
  it('reopens the current page with the request in the hash, which the server never sees', () => {
    const url = pageMountUrl({ pathname: '/pricing', search: '?plan=pro' }, REQUEST);

    expect(url.startsWith('/pricing?plan=pro#feega-mount=')).toBe(true);
    expect(requestOfHash(url.slice(url.indexOf('#')))).toEqual(REQUEST);
  });
});

describe('requestOfHash', () => {
  it('ignores a hash that is not a mount request', () => {
    expect(requestOfHash('#section')).toBeNull();
    expect(requestOfHash('')).toBeNull();
    expect(requestOfHash('#feega-mount=%7B')).toBeNull();
  });
});

describe('controlsOfProps', () => {
  it('offers a control per prop of a kind it can edit', () => {
    const controls = controlsOfProps({ label: 'Hi', count: 2, big: true, nested: { a: 1 }, onClick: { $fn: true } });

    expect(controls).toEqual([
      { name: 'label', kind: PropKind.Text, required: false, default: 'Hi' },
      { name: 'count', kind: PropKind.Number, required: false, default: 2 },
      { name: 'big', kind: PropKind.Toggle, required: false, default: true }
    ]);
  });
});

describe('startPageMount', () => {
  function page() {
    const win = new JSDOM(`<!doctype html><body><main><h2 ${SOURCE_ATTR}="${SOURCE}">Hi</h2></main></body>`, { pretendToBeVisual: true }).window as unknown as Window & Record<string | symbol, unknown>;
    const Card = function Card() {};
    (win.document.querySelector('h2') as unknown as Record<string, unknown>)['__reactFiber$k'] = { tag: 5, type: 'h2', memoizedProps: {}, return: { tag: 0, type: Card, memoizedProps: {}, return: null } };
    const rendered: unknown[] = [];
    const react = { createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }), Component: class {}, Fragment: Symbol('fragment') };
    const createRoot = () => ({ render: (tree: unknown) => rendered.push(tree) });
    const modules = { react, createRoot };
    return { win, Card, rendered, modules };
  }

  it('flags the document as a nested host before anything else, so the focus tab keeps it', () => {
    const { win, modules } = page();
    startPageMount({ win, request: REQUEST, modules: () => modules });

    expect(win[NESTED_HOST]).toBe(true);
  });

  it('renders the component the page already has, in a root of its own', () => {
    const { win, Card, rendered, modules } = page();
    startPageMount({ win, request: REQUEST, modules: () => modules });

    const shown = (rendered[0] as { children: { children: { type: unknown; props: unknown }[] }[] }).children[0].children[0];
    expect(shown.type).toBe(Card);
    expect(shown.props).toEqual({ label: 'Hi' });
    expect(win.document.querySelector('body > #root')).not.toBeNull();
  });

  it('mounts once even when the bridge is loaded by two entries of the bundle', () => {
    const { win, rendered, modules } = page();
    startPageMount({ win, request: REQUEST, modules: () => modules });
    startPageMount({ win, request: REQUEST, modules: () => modules });

    expect(rendered).toHaveLength(1);
  });

  it('does nothing yet when the page has not rendered the component', () => {
    const { win, rendered, modules } = page();

    expect(startPageMount({ win, request: { ...REQUEST, source: 'app/Gone.tsx:1:1' }, modules: () => modules })).toBe(false);
    expect(rendered).toEqual([]);
  });
});

describe('webpackModules', () => {
  it('finds React and createRoot among the modules the Next.js bundle has loaded', () => {
    const react = { createElement: () => null, Component: class {}, Fragment: Symbol('f') };
    const client = { createRoot: () => null };
    const cache = { a: { exports: react }, b: { exports: client }, c: { exports: {} } };
    const win = { webpackChunk_N_E: { push: ([, , run]: [unknown, unknown, (req: unknown) => void]) => run({ c: cache }) } };

    expect(webpackModules(win as never)).toEqual({ react, createRoot: client.createRoot });
  });

  it('finds nothing when the bundle is not webpack', () => {
    expect(webpackModules({} as never)).toBeNull();
  });
});
