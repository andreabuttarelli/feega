import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { inspectElement, treeOf } from './runtime.js';

const doc = () =>
  new JSDOM(`<body><section data-feega-ghost="" data-feega-src="src/App.tsx:5:1"><article data-feega-src="src/Card.tsx:4:5"><h2 data-feega-src="src/Card.tsx:5:7">One</h2></article></section></body>`).window.document;

describe('the parent a focus tab keeps only to know where the component is used', () => {
  it('is not a layer, and the component root is', () => {
    const [html] = treeOf(doc());
    const [body] = html.children;

    expect(body.children).toHaveLength(1);
    expect(body.children[0]).toEqual(expect.objectContaining({ name: 'Card', component: true }));
  });

  it('leaves the component as the root of the tree when asked for a bare one', () => {
    const tree = treeOf(doc(), { bare: true });

    expect(tree).toHaveLength(1);
    expect(tree[0]).toEqual(expect.objectContaining({ name: 'Card', component: true }));
  });

  it('is not in the crumbs', () => {
    const info = inspectElement(doc().querySelector('h2')!)!;

    expect(info.ancestors.map((a: { name: string }) => a.name)).toEqual(['html', 'body', 'Card']);
  });

  it('still tells where the component is used', () => {
    expect(inspectElement(doc().querySelector('h2')!)!.component).toEqual({ file: 'src/App.tsx', line: 5, col: 1 });
  });

  it('takes the instances and the usage from the page when it is given its twin', () => {
    const page = new JSDOM(`<body><section data-feega-src="src/App.tsx:5:1"><h2 data-feega-src="src/Card.tsx:5:7">a</h2><h2 data-feega-src="src/Card.tsx:5:7">b</h2><h2 data-feega-src="src/Card.tsx:5:7">c</h2></section></body>`).window.document;
    const twin = () => page.querySelectorAll('h2')[2];

    const info = inspectElement(doc().querySelector('h2')!, { twin })!;

    expect(info.instances).toBe(3);
    expect(info.usage).toEqual({ index: 2, count: 3 });
  });
});
