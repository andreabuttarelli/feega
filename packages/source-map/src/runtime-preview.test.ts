import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { clearPreview, clearPreviews, hidePreview, inspectElement, keepPreviews, previewEdit, settlePreview } from './runtime.js';

const SOURCE = 'components/Card.tsx:3:5';

const page = `<section data-feega-src="components/Card.tsx:2:3">
  <h1 data-feega-src="${SOURCE}">Title</h1>
  <b>plain</b>
</section>`;

const domOf = () => new JSDOM(`<head></head><body>${page}</body>`).window;

describe('hidden in the preview only', () => {
  it('hides every element with that source and shows it again', () => {
    const win = domOf();
    hidePreview(win.document, SOURCE, true);
    const h1 = win.document.querySelector('h1')!;

    expect(win.getComputedStyle(h1).display).toBe('none');
    hidePreview(win.document, SOURCE, false);
    expect(win.getComputedStyle(h1).display).not.toBe('none');
  });
});

describe('what the element is', () => {
  it('an element holding only inline text elements carries inline text', () => {
    const doc = domOf().document;
    const box = doc.createElement('div');
    box.innerHTML = '<span>Ship</span> <strong>fast<br><em>now</em></strong>';
    box.setAttribute('data-feega-src', 'src/A.svelte:1:1');
    doc.body.append(box);

    expect(inspectElement(box)!.inlineText).toBe(true);
    expect(inspectElement(doc.querySelector('section')!)!.inlineText).toBe(false);
  });

  const inspected = (html: string) => {
    const doc = domOf().document;
    const box = doc.createElement('div');
    box.innerHTML = html;
    box.setAttribute('data-feega-src', 'src/A.svelte:1:1');
    doc.body.append(box);
    return inspectElement(box)!;
  };

  it('a div of button links is not inline text', () => {
    const info = inspected('<a class="btn" style="display:inline-block;padding:8px">Get started</a><a class="btn" style="display:inline-block;padding:8px">Docs</a>');

    expect(info.inlineText).toBe(false);
  });

  it('a nav of plain links is not inline text', () => {
    expect(inspected('<a href="/a">Home</a> <a href="/b">Pricing</a>').inlineText).toBe(false);
  });

  it('prose with an inline link is inline text', () => {
    expect(inspected('Read the <a href="/d">docs</a> now.').inlineText).toBe(true);
  });

  it('text with span and strong is inline text', () => {
    expect(inspected('Ship <span>fast</span> and <strong>sure</strong>').inlineText).toBe(true);
  });

  it('a heading has its own text and no element children', () => {
    const info = inspectElement(domOf().document.querySelector('h1')!)!;

    expect(info.ownText).toBe(true);
    expect(info.elements).toBe(0);
  });

  it('a section has element children and no own text', () => {
    const info = inspectElement(domOf().document.querySelector('section')!)!;

    expect(info.ownText).toBe(false);
    expect(info.elements).toBe(2);
  });
});

describe('a preview survives hot reload until the class lands', () => {
  it('an element re-rendered with the same source gets the preview back', () => {
    const win = domOf();
    previewEdit(win.document, { source: SOURCE, style: { fontWeight: '700' } });

    const fresh = win.document.createElement('h1');
    fresh.setAttribute('data-feega-src', SOURCE);
    win.document.querySelector('h1')!.replaceWith(fresh);
    keepPreviews(win.document);

    expect(win.getComputedStyle(fresh).fontWeight).toBe('700');
  });

  it('a value the source writes inline counts as landed, not as no effect', () => {
    const win = domOf();
    previewEdit(win.document, { source: SOURCE, style: { color: 'rgb(0, 120, 212)' } });
    win.document.querySelector('h1')!.setAttribute('style', 'color: rgb(0, 120, 212)');

    expect(settlePreview(win.document, SOURCE)).toEqual([]);
  });

  it('settling drops the inline style once the page alone gives the same value', () => {
    const win = domOf();
    const style = win.document.createElement('style');
    style.textContent = '.font-bold { font-weight: 700 }';
    win.document.head.append(style);
    previewEdit(win.document, { source: SOURCE, style: { fontWeight: '700' } });
    win.document.querySelector('h1')!.className = 'font-bold';

    expect(settlePreview(win.document, SOURCE)).toEqual([]);
    expect(win.document.getElementById('feega-preview')!.textContent).toBe('');
  });

  it('settling keeps and reports a style the written class does not produce', () => {
    const win = domOf();
    previewEdit(win.document, { source: SOURCE, style: { fontSize: '40px' } });

    expect(settlePreview(win.document, SOURCE)).toEqual(['font-size']);
    expect(win.getComputedStyle(win.document.querySelector('h1')!).fontSize).toBe('40px');
  });

  it('clearing removes the preview, for a write that was refused', () => {
    const win = domOf();
    previewEdit(win.document, { source: SOURCE, style: { fontSize: '40px' } });
    clearPreview(win.document, SOURCE);

    expect(win.getComputedStyle(win.document.querySelector('h1')!).fontSize).not.toBe('40px');
    expect(settlePreview(win.document, SOURCE)).toEqual([]);
  });
});

describe('a preview made in an element state', () => {
  it('shows only while that state is forced on the element', () => {
    const win = domOf();
    const h1 = win.document.querySelector('h1')!;
    previewEdit(win.document, { source: SOURCE, state: 'hover', style: { color: 'rgb(9, 9, 9)' } });

    expect(win.getComputedStyle(h1).color).not.toBe('rgb(9, 9, 9)');
    h1.setAttribute('data-feega-force', 'hover');
    expect(win.getComputedStyle(h1).color).toBe('rgb(9, 9, 9)');
  });

  it('is kept apart from the default preview of the same element', () => {
    const win = domOf();
    const h1 = win.document.querySelector('h1')!;
    previewEdit(win.document, { source: SOURCE, style: { color: 'rgb(1, 1, 1)' } });
    previewEdit(win.document, { source: SOURCE, state: 'hover', style: { color: 'rgb(9, 9, 9)' } });
    clearPreview(win.document, SOURCE, 'hover');

    expect(win.getComputedStyle(h1).color).toBe('rgb(1, 1, 1)');
  });

  it('settles against the forced look and drops once the page gives the same value', () => {
    const win = domOf();
    const h1 = win.document.querySelector('h1')!;
    const style = win.document.createElement('style');
    style.textContent = '.red[data-feega-force~="hover"] { color: rgb(255, 0, 0) }';
    win.document.head.append(style);
    h1.setAttribute('data-feega-force', 'hover');
    previewEdit(win.document, { source: SOURCE, state: 'hover', style: { color: 'rgb(255, 0, 0)' } });
    h1.className = 'red';

    expect(settlePreview(win.document, SOURCE, 'hover')).toEqual([]);
    expect(win.document.getElementById('feega-preview')!.textContent).toBe('');
  });
});

describe('clearing every preview', () => {
  it('drops the overrides of all elements, as after an undo', () => {
    const win = domOf();
    previewEdit(win.document, { source: SOURCE, style: { fontSize: '40px' } });
    previewEdit(win.document, { source: SOURCE, state: 'hover', style: { color: 'rgb(9, 9, 9)' } });
    clearPreviews(win.document);

    expect(win.document.getElementById('feega-preview')!.textContent).toBe('');
  });
});
