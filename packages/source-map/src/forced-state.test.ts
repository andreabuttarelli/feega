import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { forceState, keepForced, statesOf } from './forced-state.js';

const SOURCE = 'src/Button.tsx:3:5';

const STYLES = `
.btn { background: white; color: black; }
.btn:hover { background: red; }
.btn:focus-visible { background: blue; }
.btn:focus { color: green; }
.btn:active { background: orange; }
.btn:disabled { background: gray; }
.hover\\:bg-teal:hover { background: teal; }
.card:hover .title { color: purple; }
@media (min-width: 100px) { .btn:hover { color: crimson; } }
@media (hover: hover) { .only-hover:hover { color: pink; } }
`;

function page(extra = '') {
  const dom = new JSDOM(`<head><style>${STYLES}</style></head><body><div class="card" data-feega-src="src/Card.tsx:1:1"><h2 class="title" data-feega-src="src/Card.tsx:2:3">T</h2><button class="btn ${extra}" data-feega-src="${SOURCE}">Go</button></div></body>`);
  const win = dom.window as unknown as Window & typeof globalThis;
  return { doc: win.document, win, btn: win.document.querySelector('.btn')!, title: win.document.querySelector('.title')! };
}

const RGB: Record<string, string> = { white: 'rgb(255, 255, 255)', red: 'rgb(255, 0, 0)', orange: 'rgb(255, 165, 0)', teal: 'rgb(0, 128, 128)', blue: 'rgb(0, 0, 255)', green: 'rgb(0, 128, 0)', gray: 'rgb(128, 128, 128)', purple: 'rgb(128, 0, 128)', navy: 'rgb(0, 0, 128)' };

const colour = (win: Window, el: Element, prop: string) => Object.entries(RGB).find(([, v]) => v === win.getComputedStyle(el).getPropertyValue(prop))?.[0];

const forcedCss = (doc: Document) => doc.getElementById('feega-forced')?.textContent ?? '';

describe('a state forced on the page', () => {
  it('shows the :hover rules on the element without the mouse', () => {
    const { doc, win, btn } = page();
    expect(colour(win, btn, 'background-color')).toBe('white');

    forceState(doc, SOURCE, 'hover');

    expect(colour(win, btn, 'background-color')).toBe('red');
  });

  it('clearing returns to the normal look', () => {
    const { doc, win, btn } = page();
    forceState(doc, SOURCE, 'hover');
    forceState(doc, SOURCE, null);

    expect(colour(win, btn, 'background-color')).toBe('white');
    expect(btn.hasAttribute('data-feega-force')).toBe(false);
  });

  it('forces one state at a time', () => {
    const { doc, win, btn } = page();
    forceState(doc, SOURCE, 'hover');
    forceState(doc, SOURCE, 'active');

    expect(colour(win, btn, 'background-color')).toBe('orange');
  });

  it('forces focus, focus-visible and disabled with their own rules', () => {
    const { doc, win, btn } = page();
    forceState(doc, SOURCE, 'focus-visible');
    expect(colour(win, btn, 'background-color')).toBe('blue');
    forceState(doc, SOURCE, 'focus');
    expect(colour(win, btn, 'color')).toBe('green');
    forceState(doc, SOURCE, 'disabled');
    expect(colour(win, btn, 'background-color')).toBe('gray');
  });

  it('forces a Tailwind hover utility, whose class name has an escaped colon', () => {
    const { doc, win, btn } = page('hover:bg-teal');
    forceState(doc, SOURCE, 'hover');

    expect(colour(win, btn, 'background-color')).toBe('teal');
  });

  it('keeps the rules wrapped in their media query', () => {
    const { doc } = page();
    forceState(doc, SOURCE, 'hover');

    expect(forcedCss(doc)).toMatch(/@media \(min-width: 100px\) \{[^@]*\.btn\[data-feega-force~="hover"\] \{ color: crimson/);
  });

  it('forces a hover rule that sits behind a hover media query', () => {
    const { doc } = page('only-hover');
    forceState(doc, SOURCE, 'hover');

    expect(forcedCss(doc)).not.toContain('(hover: hover)');
    expect(forcedCss(doc)).toContain('.only-hover[data-feega-force~="hover"]');
  });

  it('hover reaches the children through the hovered ancestor rules', () => {
    const { doc, win, title } = page();
    forceState(doc, 'src/Card.tsx:1:1', 'hover');

    expect(colour(win, title, 'color')).toBe('purple');
  });

  it('hover forced on a child also counts for its ancestors', () => {
    const { doc, win, title } = page();
    forceState(doc, 'src/Card.tsx:2:3', 'hover');

    expect(doc.querySelector('.card')!.getAttribute('data-feega-force')).toBe('hover');
    expect(colour(win, title, 'color')).toBe('purple');
  });

  it('follows a stylesheet that changes while the state is forced', () => {
    const { doc, win, btn } = page();
    forceState(doc, SOURCE, 'hover');
    doc.querySelector('style')!.textContent += '.btn:hover { background: navy; }';
    keepForced(doc);

    expect(colour(win, btn, 'background-color')).toBe('navy');
  });
});

describe('the states an element has styles for', () => {
  it('lists the states with at least one rule that reaches the element', () => {
    const { btn } = page();

    expect(statesOf(btn).sort()).toEqual(['active', 'disabled', 'focus', 'focus-visible', 'hover']);
  });

  it('counts a hover rule of an ancestor that reaches the element', () => {
    const { title } = page();

    expect(statesOf(title)).toEqual(['hover']);
  });

  it('is empty for an element nothing styles', () => {
    const { doc } = page();
    const bare = doc.createElement('p');
    doc.body.append(bare);

    expect(statesOf(bare)).toEqual([]);
  });

  it('counts a Tailwind utility of the element', () => {
    const { doc } = page();
    const teal = doc.createElement('a');
    teal.className = 'hover:bg-teal';
    doc.body.append(teal);

    expect(statesOf(teal)).toEqual(['hover']);
  });
});
