import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { inspectElement, parseSource } from './runtime.js';
import { installBridge } from './bridge.js';

const page = `<main data-feega-src="app/page.tsx:4:5">
  <section data-feega-src="components/Card.tsx:2:3" style="padding: 12px; color: rgb(255, 0, 0)">
    <h1 data-feega-src="components/Card.tsx:3:5">${'Title '.repeat(200)}</h1>
    <b>plain</b>
  </section>
</main>`;

const domOf = () => new JSDOM(`<body>${page}</body>`, { runScripts: 'outside-only' }).window;

describe('parseSource', () => {
  it('splits file, line and col, also with colons in the path', () => {
    expect(parseSource('C:/a/b.tsx:10:3')).toEqual({ file: 'C:/a/b.tsx', line: 10, col: 3 });
    expect(parseSource('nonsense')).toBeNull();
  });
});

describe('inspectElement', () => {
  it('returns source, design styles, truncated html and the component boundary', () => {
    const win = domOf();
    const h1 = win.document.querySelector('h1')!;

    const info = inspectElement(h1, { maxHtml: 100 })!;

    expect(info.source).toEqual({ file: 'components/Card.tsx', line: 3, col: 5 });
    expect(info.html.length).toBeLessThanOrEqual(101);
    expect(info.html.endsWith('…')).toBe(true);
    expect(info.component).toEqual({ file: 'app/page.tsx', line: 4, col: 5 });
    expect(info.styles).toHaveProperty('font-size');
  });

  it('an element of a page belongs to the page, not to the layout that renders it in its slot', () => {
    const win = new JSDOM(`<body><main data-feega-src="src/routes/+layout.svelte:20:3"><section data-feega-src="src/routes/+page.svelte:5:1"><h1 data-feega-src="src/routes/+page.svelte:6:3">Hi</h1></section></main></body>`).window;

    const info = inspectElement(win.document.querySelector('h1')!)!;

    expect(info.component).toEqual({ file: 'src/routes/+page.svelte', line: 5, col: 1 });
  });

  it('climbs to the nearest tagged ancestor for an untagged element', () => {
    const win = domOf();

    const info = inspectElement(win.document.querySelector('b')!)!;

    expect(info.source).toEqual({ file: 'components/Card.tsx', line: 2, col: 3 });
    expect(info.styles.color).toBe('rgb(255, 0, 0)');
    expect(info.styles['padding-top']).toBe('12px');
  });

  it('names where an inherited value comes from', () => {
    const win = domOf();

    const info = inspectElement(win.document.querySelector('h1')!)!;

    expect(info.inherited.color).toBe('section');
    expect(info.inherited).not.toHaveProperty('padding-top');
  });

  it('returns null outside any mapped element', () => {
    const win = new JSDOM('<body><p>x</p></body>').window;

    expect(inspectElement(win.document.querySelector('p')!)).toBeNull();
  });
});

describe('bridge', () => {
  it('answers an inspect request by selector with the request id', async () => {
    const win = domOf();
    installBridge(win as unknown as Window);
    const replies: unknown[] = [];
    const parent = { postMessage: (data: unknown) => replies.push(data) };

    win.dispatchEvent(
      new win.MessageEvent('message', {
        data: { type: 'feega:inspect', id: 7, selector: 'h1' },
        source: parent as unknown as Window
      })
    );

    expect(replies).toEqual([
      expect.objectContaining({
        type: 'feega:inspect:result',
        id: 7,
        result: expect.objectContaining({ source: { file: 'components/Card.tsx', line: 3, col: 5 } })
      })
    ]);
  });

  it('previews an edit on every element with that source, before the file changes', () => {
    const win = domOf();
    installBridge(win as unknown as Window);

    win.dispatchEvent(
      new win.MessageEvent('message', {
        data: { type: 'feega:preview', source: 'components/Card.tsx:3:5', text: 'New title', style: { color: 'rgb(0, 0, 255)' } }
      })
    );

    const h1 = win.document.querySelector('h1')!;
    expect(h1.textContent).toBe('New title');
    expect(win.getComputedStyle(h1).color).toBe('rgb(0, 0, 255)');
  });
});

describe('inspectElement for editing', () => {
  it('gives the box, the classes and the own text of a leaf element', () => {
    const win = domOf();

    const info = inspectElement(win.document.querySelector('h1')!)!;

    expect(info.rect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(info.text?.startsWith('Title Title')).toBe(true);
    expect(info.classes).toBe('');
  });

  it('has no text for an element with element children', () => {
    const win = domOf();

    expect(inspectElement(win.document.querySelector('section')!)!.text).toBeNull();
  });
});
