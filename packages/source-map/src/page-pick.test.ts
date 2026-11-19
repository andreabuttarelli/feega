import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { PAGE_SOURCE, inspectElement, previewEdit, relativeOf } from './runtime.js';

const dom = () => new JSDOM('<body><main data-feega-src="src/A.svelte:1:1">x</main></body>').window;

describe('the page itself', () => {
  it('a click on the bare body selects the page', () => {
    const info = inspectElement(dom().document.body)!;

    expect(info.page).toBe('body');
    expect(`${info.source.file}:${info.source.line}:${info.source.col}`).toBe(PAGE_SOURCE);
    expect(info.name).toBe('Page');
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
});
