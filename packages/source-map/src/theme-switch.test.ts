import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { applyTheme, keepTheme, themeNow, watchScheme } from './theme-switch.js';

const DARK_CLASS = { kind: 'class', target: 'html', value: 'dark' };
const LIGHT_CLASS = { kind: 'class', target: 'html', value: 'light' };
const FOREST = { kind: 'attribute', target: 'html', attribute: 'data-theme', value: 'forest' };
const SAND = { kind: 'attribute', target: 'html', attribute: 'data-theme', value: 'sand' };
const DARK_MEDIA = { kind: 'media', target: 'html', value: 'dark' };
const LIGHT_MEDIA = { kind: 'media', target: 'html', value: 'light' };
const ALL = [DARK_CLASS, LIGHT_CLASS, FOREST, SAND, DARK_MEDIA, LIGHT_MEDIA];

const CSS = `
.a { color: black; }
@media (prefers-color-scheme: dark) { .a { color: white; } }
@media (min-width: 640px) and (prefers-color-scheme: dark) { .a { color: gray; } }
@media (prefers-color-scheme: light) { .a { color: ivory; } }
@media (min-width: 100px) { .a { color: red; } }
@supports (display: grid) { @media (prefers-color-scheme: dark) { .b { color: blue; } } }
`;

function page(html = '<html><head><style>' + CSS + '</style></head><body><p class="a">x</p></body></html>', systemDark = false) {
  const dom = new JSDOM(html);
  const win = dom.window as unknown as Window & typeof globalThis;
  const asked: string[] = [];
  (win as unknown as { matchMedia: unknown }).matchMedia = (query: string) => {
    asked.push(query);
    return { media: query, matches: query.includes('prefers-color-scheme: dark') ? systemDark : query === '(min-width: 0px)', addEventListener() {}, removeEventListener() {} };
  };
  watchScheme(win);
  return { doc: win.document, win, asked };
}

const medias = (doc: Document) => {
  const out: string[] = [];
  const walk = (rules: CSSRuleList) => [...rules].forEach((r) => ('media' in r ? out.push((r as CSSMediaRule).media.mediaText) : 'cssRules' in r && walk((r as CSSGroupingRule).cssRules)));
  [...doc.styleSheets].forEach((s) => walk(s.cssRules));
  return out;
};

describe('a theme applied to the page', () => {
  it('adds the class to the root', () => {
    const { doc } = page();
    applyTheme(doc, { themes: ALL, active: DARK_CLASS });
    expect(doc.documentElement.classList.contains('dark')).toBe(true);
  });

  it('swaps one class theme for another', () => {
    const { doc } = page();
    applyTheme(doc, { themes: ALL, active: DARK_CLASS });
    applyTheme(doc, { themes: ALL, active: LIGHT_CLASS });
    expect(doc.documentElement.className).toBe('light');
  });

  it('puts the attribute on the root and swaps the value', () => {
    const { doc } = page();
    applyTheme(doc, { themes: ALL, active: FOREST });
    expect(doc.documentElement.getAttribute('data-theme')).toBe('forest');
    applyTheme(doc, { themes: ALL, active: SAND });
    expect(doc.documentElement.getAttribute('data-theme')).toBe('sand');
  });

  it('restores what the page had on default', () => {
    const { doc } = page('<html class="dark keep" data-theme="forest"><head></head><body></body></html>');
    applyTheme(doc, { themes: ALL, active: LIGHT_CLASS });
    applyTheme(doc, { themes: ALL, active: SAND });
    applyTheme(doc, { themes: ALL, active: null });
    expect(doc.documentElement.className).toBe('dark keep');
    expect(doc.documentElement.getAttribute('data-theme')).toBe('forest');
  });

  it('removes an attribute the page did not have', () => {
    const { doc } = page();
    applyTheme(doc, { themes: ALL, active: FOREST });
    applyTheme(doc, { themes: ALL, active: null });
    expect(doc.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('puts the class back when the app removes it', async () => {
    const { doc, win } = page();
    applyTheme(doc, { themes: ALL, active: DARK_CLASS });
    doc.documentElement.className = '';
    await new Promise((r) => win.setTimeout(r, 0));
    expect(doc.documentElement.classList.contains('dark')).toBe(true);
  });

  it('says which theme is on', () => {
    const { doc } = page();
    expect(themeNow(doc)).toBeNull();
    applyTheme(doc, { themes: ALL, active: FOREST });
    expect(themeNow(doc)).toEqual(FOREST);
  });
});

describe('a media theme emulated on the page', () => {
  it('turns the dark queries on and the light ones off', () => {
    const { doc } = page();
    applyTheme(doc, { themes: ALL, active: DARK_MEDIA });
    expect(medias(doc)).toEqual(['(min-width: 0px)', '(min-width: 640px) and (min-width: 0px)', '(min-width: 100000px)', '(min-width: 100px)', '(min-width: 0px)']);
  });

  it('turns the light queries on for light', () => {
    const { doc } = page();
    applyTheme(doc, { themes: ALL, active: LIGHT_MEDIA });
    expect(medias(doc)).toEqual(['(min-width: 100000px)', '(min-width: 640px) and (min-width: 100000px)', '(min-width: 0px)', '(min-width: 100px)', '(min-width: 100000px)']);
  });

  it('restores the queries on default', () => {
    const { doc } = page();
    applyTheme(doc, { themes: ALL, active: DARK_MEDIA });
    applyTheme(doc, { themes: ALL, active: null });
    expect(medias(doc)).toEqual(['(prefers-color-scheme: dark)', '(min-width: 640px) and (prefers-color-scheme: dark)', '(prefers-color-scheme: light)', '(min-width: 100px)', '(prefers-color-scheme: dark)']);
  });

  it('rewrites a rule added after the switch', () => {
    const { doc } = page();
    applyTheme(doc, { themes: ALL, active: DARK_MEDIA });
    const style = doc.createElement('style');
    style.textContent = '@media (prefers-color-scheme: dark) { .c { color: pink; } }';
    doc.head.append(style);
    keepTheme(doc);
    expect(medias(doc).at(-1)).toBe('(min-width: 0px)');
  });

  it('answers matchMedia as the emulated scheme', () => {
    const { doc, win } = page(undefined, false);
    applyTheme(doc, { themes: ALL, active: DARK_MEDIA });
    expect(win.matchMedia('(prefers-color-scheme: dark)').matches).toBe(true);
    expect(win.matchMedia('(prefers-color-scheme: light)').matches).toBe(false);
  });

  it('tells matchMedia listeners when the scheme changes', () => {
    const { doc, win } = page(undefined, false);
    const mql = win.matchMedia('(prefers-color-scheme: dark)');
    const heard = vi.fn();
    mql.addEventListener('change', heard);
    applyTheme(doc, { themes: ALL, active: DARK_MEDIA });
    expect(heard).toHaveBeenCalledWith(expect.objectContaining({ matches: true }));
    applyTheme(doc, { themes: ALL, active: null });
    expect(heard).toHaveBeenLastCalledWith(expect.objectContaining({ matches: false }));
  });

  it('leaves other queries to the browser', () => {
    const { doc, win, asked } = page();
    applyTheme(doc, { themes: ALL, active: DARK_MEDIA });
    win.matchMedia('(min-width: 600px)');
    expect(asked.at(-1)).toBe('(min-width: 600px)');
  });
});
