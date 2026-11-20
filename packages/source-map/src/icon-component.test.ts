import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { inspectElement, treeOf } from './runtime.js';

const USAGE = 'src/App.jsx:27:9';
const MAIN = 'src/App.jsx:23:7';
const page = `<main data-feega-src="${MAIN}" class="flex"><svg data-feega-src="${USAGE}" data-feega-icon="ArrowRight" class="lucide" width="32"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></main>`;

const dom = () => new JSDOM(`<body>${page}</body>`).window.document;

describe('an icon component from a library', () => {
  it('a click on its path selects the icon, named after the component', () => {
    const doc = dom();
    const info = inspectElement(doc.querySelector('path')!)!;

    expect(info.source).toEqual({ file: 'src/App.jsx', line: 27, col: 9 });
    expect(info.name).toBe('ArrowRight');
    expect(info.inner).toBeUndefined();
    expect(info.html.startsWith('<svg')).toBe(true);
  });

  it('keeps the bookkeeping attribute out of the properties', () => {
    const info = inspectElement(dom().querySelector('svg')!)!;

    expect(info.attributes.map((a: { name: string }) => a.name)).toEqual(['class', 'width']);
  });

  it('shows in the layers as one element, without its paths', () => {
    const [html] = treeOf(dom()) as any;
    const main = html.children[0].children[0];

    expect(main.children.map((c: { name: string }) => c.name)).toEqual(['ArrowRight']);
    expect(main.children[0].children).toEqual([]);
  });
});
