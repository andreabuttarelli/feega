import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { installBridge } from './bridge.js';
import { HTML_SOURCE, PAGE_SOURCE, inspectElement, treeOf } from './runtime.js';

const textOf = (n: { source: { file: string; line: number; col: number } | null }) => (n.source ? `${n.source.file}:${n.source.line}:${n.source.col}` : null);

const page = `<main data-feega-src="src/routes/+page.svelte:1:1">
  <section class="hero big" data-feega-src="src/lib/Hero.svelte:1:1">
    <h1 id="title" data-feega-src="src/lib/Hero.svelte:2:3"><span data-feega-src="src/lib/Hero.svelte:2:20">a</span></h1>
    <p class="lead" data-feega-src="src/lib/Hero.svelte:3:3">b</p>
    <a data-feega-src="src/lib/Hero.svelte:4:3">c</a>
  </section>
</main>`;

const domOf = () => new JSDOM(`<body>${page}</body>`).window;

describe('ancestors', () => {
  it('lists the mapped ancestors from the root, named by component or readable type', () => {
    const info = inspectElement(domOf().document.querySelector('span')!)!;

    expect(info.name).toBe('a');
    expect(info.ancestors.map((a: { name: string }) => a.name)).toEqual(['html', 'body', 'Main', 'Hero', 'Heading 1']);
    expect(info.ancestors[3].source).toEqual({ file: 'src/lib/Hero.svelte', line: 1, col: 1 });
  });
});

describe('layers tree', () => {
  it('builds the mapped tree with names, folding repeated items into one node', () => {
    const win = new JSDOM(`<body><ul data-feega-src="a.svelte:1:1"><li data-feega-src="a.svelte:2:3">a</li><li data-feega-src="a.svelte:2:3">b</li><li data-feega-src="a.svelte:2:3">c</li></ul></body>`).window;

    const [html] = treeOf(win.document);
    const [body] = html.children;

    expect(body.children).toEqual([
      expect.objectContaining({ name: 'List', tag: 'ul', display: 'block', source: { file: 'a.svelte', line: 1, col: 1 }, component: false, count: 1, children: [expect.objectContaining({ name: 'a', tag: 'li', source: { file: 'a.svelte', line: 2, col: 3 }, component: false, count: 3, children: [] })] })
    ]);
  });
});

describe('head group', () => {
  const doc = () => new JSDOM(`<head><title data-feega-src="a.svelte:1:1">t</title><meta name="d" data-feega-src="a.svelte:2:1"></head><body><main data-feega-src="a.svelte:4:1"></main></body>`).window.document;

  it('the root is html, holding a Head group then body', () => {
    const tree = treeOf(doc());

    expect(tree.map((n: { name: string }) => n.name)).toEqual(['html']);
    expect(textOf(tree[0])).toBe(HTML_SOURCE);
    expect(tree[0].children.map((n: { name: string }) => n.name)).toEqual(['Head', 'body']);
  });

  it('the Head group has no source and counts its elements', () => {
    const [head] = treeOf(doc())[0].children;

    expect(head.source).toBeNull();
    expect(head.count).toBe(2);
    expect(head.children.map((n: { tag: string }) => n.tag)).toEqual(['title', 'meta']);
  });

  it('body is selectable and holds the page tree', () => {
    const body = treeOf(doc())[0].children[1];

    expect(textOf(body)).toBe(PAGE_SOURCE);
    expect(body.children.map((n: { tag: string }) => n.tag)).toEqual(['main']);
  });

  it('a page without head elements has no Head group', () => {
    const win = new JSDOM(`<body><main data-feega-src="a.svelte:1:1"></main></body>`).window;

    expect(treeOf(win.document)[0].children.map((n: { name: string }) => n.name)).toEqual(['body']);
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
    expect(ask('child', 'src/lib/Hero.svelte:1:1')).toBe('Heading 1');
    expect(ask('next', 'src/lib/Hero.svelte:3:3')).toBe('c');
    expect(ask('previous', 'src/lib/Hero.svelte:3:3')).toBe('Heading 1');
  });

  it('past the last sibling there is nothing to move to', () => {
    expect(ask('next', 'src/lib/Hero.svelte:4:3')).toBeNull();
  });
});

describe('a tree asked before the app rendered', () => {
  it('is sent again once the page fills in', async () => {
    const win = new JSDOM('<body><div id="root"></div></body>').window;
    installBridge(win as unknown as Window);
    const replies: { type: string; tree?: { children: { children: unknown[] }[] }[] }[] = [];
    const parent = { postMessage: (data: { type: string }) => replies.push(data) };
    win.dispatchEvent(new win.MessageEvent('message', { data: { type: 'feega:tree' }, source: parent as unknown as Window }));
    win.document.getElementById('root')!.innerHTML = '<main data-feega-src="src/App.jsx:3:5">hi</main>';
    await new Promise((resolve) => setTimeout(resolve, 400));

    const trees = replies.filter((r) => r.type === 'feega:tree:result');
    const last = trees.at(-1)!.tree![0];
    expect(trees.length).toBeGreaterThan(1);
    expect(JSON.stringify(last)).toContain('src/App.jsx');
  });
});

describe('a tree asked before the page changed in place', () => {
  const askTree = (win: JSDOM['window']) => {
    const replies: { type: string; tree?: unknown }[] = [];
    const parent = { postMessage: (data: { type: string }) => replies.push(data) };
    win.dispatchEvent(new win.MessageEvent('message', { data: { type: 'feega:tree' }, source: parent as unknown as Window }));
    return () => JSON.stringify(replies.filter((r) => r.type === 'feega:tree:result').at(-1)!.tree);
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

  it('is sent again when a class renames a node', async () => {
    const win = new JSDOM('<body><main data-feega-src="src/App.jsx:3:5" class="old"></main></body>').window;
    installBridge(win as unknown as Window);
    const latest = askTree(win);

    win.document.querySelector('main')!.className = 'fresh';
    await settle();

    expect(latest()).toContain('"name":"Fresh"');
  });

  it('is sent again when the source position of a node moves', async () => {
    const win = new JSDOM('<body><main data-feega-src="src/App.jsx:3:5"></main></body>').window;
    installBridge(win as unknown as Window);
    const latest = askTree(win);

    win.document.querySelector('main')!.setAttribute('data-feega-src', 'src/App.jsx:9:5');
    await settle();

    expect(latest()).toContain('"line":9');
  });

  it('is sent again when an inline style changes the display', async () => {
    const win = new JSDOM('<body><main data-feega-src="src/App.jsx:3:5"></main></body>').window;
    installBridge(win as unknown as Window);
    const latest = askTree(win);

    win.document.querySelector('main')!.style.display = 'flex';
    await settle();

    expect(latest()).toContain('"display":"flex"');
  });
});

describe('layers tree position', () => {
  it('carries the computed position of every node', () => {
    const win = new JSDOM(`<body><main data-feega-src="a.svelte:1:1"><div style="position:absolute" data-feega-src="a.svelte:2:3">a</div><div style="position:sticky" data-feega-src="a.svelte:3:3">b</div><div data-feega-src="a.svelte:4:3">c</div></main></body>`).window;

    const [html] = treeOf(win.document);
    const [body] = html.children;
    const [main] = body.children;

    expect(main.position).toBe('static');
    expect(main.children.map((c: { position: string }) => c.position)).toEqual(['absolute', 'sticky', 'static']);
    expect(html.position).toBe('static');
    expect(body.position).toBe('static');
  });
});
