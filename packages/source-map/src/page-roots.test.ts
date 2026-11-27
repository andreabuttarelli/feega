import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { PAGE_SOURCE, HTML_SOURCE, inspectElement, treeOf } from './runtime.js';

type Node = { name: string; children: Node[] };

const names = (nodes: Node[]): string[] => nodes.flatMap((n) => [n.name, ...names(n.children)]);

describe('layers tree with tagged page elements', () => {
  const doc = () => new JSDOM('<html data-feega-src="app/layout.tsx:3:5"><head></head><body data-feega-src="app/layout.tsx:4:7"><main data-feega-src="app/page.tsx:1:1"></main></body></html>').window.document;

  it('lists body once when the layout tags it', () => {
    expect(names(treeOf(doc())).filter((n) => n === 'body')).toHaveLength(1);
    expect(names(treeOf(doc())).filter((n) => n === 'html')).toHaveLength(1);
  });

  it('keeps the page children under the single body', () => {
    const [html] = treeOf(doc());

    expect(html.children.map((n: Node) => n.name)).toEqual(['body']);
    expect(html.children[0].children.map((n: Node) => n.name)).toEqual(['Main']);
  });

  it('the page elements stay selectable under their page sources', () => {
    const d = doc();
    const [html] = treeOf(d) as any;

    expect(html.source.file).toBe(HTML_SOURCE.split(':')[0]);
    expect(html.children[0].source.file).toBe(PAGE_SOURCE.split(':')[0]);
    expect(inspectElement(d.body)!.page).toBe('body');
    expect(inspectElement(d.documentElement)!.page).toBe('html');
  });

  it('a mapped element lists html and body once in its breadcrumb', () => {
    const info = inspectElement(doc().querySelector('main')!)!;

    expect(info.ancestors.map((a: { name: string }) => a.name)).toEqual(['html', 'body']);
  });

  it('untagged page elements keep the page sources', () => {
    const d = new JSDOM('<body><main data-feega-src="a:1:1"></main></body>').window.document;

    expect(`${(treeOf(d)[0] as any).source.file}`).toBe(HTML_SOURCE.split(':')[0]);
    expect(inspectElement(d.body)!.source.file).toBe(PAGE_SOURCE.split(':')[0]);
  });
});
