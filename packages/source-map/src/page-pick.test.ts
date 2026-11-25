import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { HTML_SOURCE, PAGE_SOURCE, inspectElement, previewEdit, relativeOf } from './runtime.js';

const dom = () => new JSDOM('<body><main data-feega-src="src/A.svelte:1:1">x</main></body>').window;

describe('the page itself', () => {
  it('a click on the bare body selects the page', () => {
    const info = inspectElement(dom().document.body)!;

    expect(info.page).toBe('body');
    expect(`${info.source.file}:${info.source.line}:${info.source.col}`).toBe(PAGE_SOURCE);
    expect(info.name).toBe('body');
  });

  it('a page preview styles the body', () => {
    const win = dom();
    previewEdit(win.document, { source: PAGE_SOURCE, style: { backgroundColor: 'rgb(1, 2, 3)' } });

    expect(win.getComputedStyle(win.document.body).backgroundColor).toBe('rgb(1, 2, 3)');
  });

  it('the parent of a top-level element is the page', () => {
    const win = dom();

    expect(relativeOf(win.document, 'src/A.svelte:1:1', 'parent')).toBe(win.document.body);
  });

  it('a click on the html element selects the html rules', () => {
    const info = inspectElement(dom().document.documentElement)!;

    expect(info.page).toBe('html');
    expect(`${info.source.file}:${info.source.line}:${info.source.col}`).toBe(HTML_SOURCE);
    expect(info.ancestors).toEqual([]);
  });

  it('body sits under html in the breadcrumb', () => {
    const info = inspectElement(dom().document.body)!;

    expect(info.ancestors.map((a: { name: string }) => a.name)).toEqual(['html']);
  });

  it('an html preview styles the root element', () => {
    const win = dom();
    previewEdit(win.document, { source: HTML_SOURCE, style: { backgroundColor: 'rgb(4, 5, 6)' } });

    expect(win.getComputedStyle(win.document.documentElement).backgroundColor).toBe('rgb(4, 5, 6)');
  });

  it('the parent of the page is html', () => {
    const win = dom();

    expect(relativeOf(win.document, PAGE_SOURCE, 'parent')).toBe(win.document.documentElement);
  });

  it('a head element lists its attributes without the source stamp', () => {
    const win = new JSDOM('<head><meta name="description" content="Hi" data-feega-src="a.svelte:2:1"></head><body></body>').window;
    const info = inspectElement(win.document.querySelector('meta')!)!;

    expect(info.attributes).toEqual([{ name: 'name', value: 'description' }, { name: 'content', value: 'Hi' }]);
    expect(info.ancestors.map((a: { name: string }) => a.name)).toEqual(['html']);
  });
});

describe('colour variables', () => {
  it('lists the colour custom properties the element declares, with their values', () => {
    const win = new JSDOM(
      '<head><style>.f{--c1:#ff0000;--speed:2;--c2:initial}.f[data-x="y"]{--c3:tomato}.g{--c9:blue}</style></head><body><div class="f" data-x="y" data-feega-src="src/A.svelte:1:1" style="--c4: gold"></div></body>'
    ).window;
    const info = inspectElement(win.document.querySelector('.f'))!;

    expect(info.variables).toEqual([
      { name: '--c1', value: '#ff0000' },
      { name: '--c3', value: 'tomato' },
      { name: '--c4', value: 'gold' }
    ]);
  });
});
