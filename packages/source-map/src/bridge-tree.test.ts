import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { installBridge } from './bridge.js';
import { inspectElement, treeOf } from './runtime.js';

const page = `<main data-feega-src="src/routes/+page.svelte:1:1">
  <section class="hero big" data-feega-src="src/lib/Hero.svelte:1:1">
    <h1 id="title" data-feega-src="src/lib/Hero.svelte:2:3"><span data-feega-src="src/lib/Hero.svelte:2:20">a</span></h1>
    <p class="lead" data-feega-src="src/lib/Hero.svelte:3:3">b</p>
    <a data-feega-src="src/lib/Hero.svelte:4:3">c</a>
  </section>
</main>`;

const domOf = () => new JSDOM(`<body>${page}</body>`).window;

describe('ancestors', () => {
  it('lists the mapped ancestors from the root, named by component or tag and first class/id', () => {
    const info = inspectElement(domOf().document.querySelector('span')!)!;

    expect(info.name).toBe('span');
    expect(info.ancestors.map((a: { name: string }) => a.name)).toEqual(['main', 'Hero', 'h1#title']);
    expect(info.ancestors[1].source).toEqual({ file: 'src/lib/Hero.svelte', line: 1, col: 1 });
  });
});

describe('layers tree', () => {
  it('builds the mapped tree with names, folding repeated items into one node', () => {
    const win = new JSDOM(`<body><ul data-feega-src="a.svelte:1:1"><li data-feega-src="a.svelte:2:3">a</li><li data-feega-src="a.svelte:2:3">b</li><li data-feega-src="a.svelte:2:3">c</li></ul></body>`).window;

    expect(treeOf(win.document)).toEqual([
      expect.objectContaining({ name: 'ul', tag: 'ul', display: 'block', source: { file: 'a.svelte', line: 1, col: 1 }, component: false, count: 1, children: [expect.objectContaining({ name: 'li', tag: 'li', source: { file: 'a.svelte', line: 2, col: 3 }, component: false, count: 3, children: [] })] })
    ]);
  });
});

describe('head group', () => {
  it('head elements sit under one Head group before the body layers', () => {
    const win = new JSDOM(`<head><title data-feega-src="a.svelte:1:1">t</title><meta name="d" data-feega-src="a.svelte:2:1"></head><body><main data-feega-src="a.svelte:4:1"></main></body>`).window;
    const tree = treeOf(win.document);

    expect(tree.map((n: { name: string }) => n.name)).toEqual(['Head', 'main']);
    expect(tree[0].children.map((n: { tag: string }) => n.tag)).toEqual(['title', 'meta']);
    expect(tree[0].source).toBeNull();
  });
});

describe('moving the selection', () => {
  function ask(move: string, from: string) {
    const win = domOf();
    installBridge(win as unknown as Window);
    const replies: { result: { name: string } | null }[] = [];
    const parent = { postMessage: (data: { result: { name: string } | null }) => replies.push(data) };
    win.dispatchEvent(new win.MessageEvent('message', { data: { type: 'feega:inspect', id: 1, from, move }, source: parent as unknown as Window }));
    return replies[0].result?.name ?? null;
  }

  it('parent, first child, next and previous sibling', () => {
    expect(ask('parent', 'src/lib/Hero.svelte:3:3')).toBe('Hero');
    expect(ask('child', 'src/lib/Hero.svelte:1:1')).toBe('h1#title');
    expect(ask('next', 'src/lib/Hero.svelte:3:3')).toBe('a');
    expect(ask('previous', 'src/lib/Hero.svelte:3:3')).toBe('h1#title');
  });

  it('past the last sibling there is nothing to move to', () => {
    expect(ask('next', 'src/lib/Hero.svelte:4:3')).toBeNull();
  });
});
