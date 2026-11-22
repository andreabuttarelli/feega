import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { missingFontsOf } from './missing-fonts.js';

const INSTALLED = new Set(['Helvetica', 'Georgia']);

const measure = (family: string) => (INSTALLED.has(family) ? 'wide' : 'plain');

function page(css: string, body: string, faces: { family: string; status: string }[] = []) {
  const doc = new JSDOM(`<head><style>${css}</style></head><body>${body}</body>`).window.document;
  Object.defineProperty(doc, 'fonts', { value: faces });
  return doc;
}

const stack = (family: string) => `.t { font-family: ${family}; }`;
const text = '<p class="t" data-feega-src="p:1:1">Hello</p>';

describe('missingFontsOf', () => {
  it('reports a family that is not installed, not loaded, with the font it falls back to', () => {
    const doc = page(stack("'Brandon Grotesque', sans-serif"), text);

    expect(missingFontsOf(doc, measure)).toEqual([{ family: 'Brandon Grotesque', fallback: 'sans-serif', declared: false }]);
  });

  it('keeps quiet about an installed family', () => {
    expect(missingFontsOf(page(stack('Helvetica, sans-serif'), text), measure)).toEqual([]);
  });

  it('keeps quiet about a family the page loads with @font-face', () => {
    const doc = page(stack('Brand, serif'), text, [{ family: '"Brand"', status: 'loaded' }]);

    expect(missingFontsOf(doc, measure)).toEqual([]);
  });

  it('reports a declared family whose file failed to load', () => {
    const doc = page(stack('Brand, serif'), text, [{ family: 'Brand', status: 'error' }]);

    expect(missingFontsOf(doc, measure)).toEqual([{ family: 'Brand', fallback: 'serif', declared: true }]);
  });

  it('names the next installed family of the stack as the fallback', () => {
    const doc = page(stack('Brand, Georgia, serif'), text);

    expect(missingFontsOf(doc, measure)[0].fallback).toBe('Georgia');
  });

  it('stops at a system keyword: a system stack is not a missing font', () => {
    expect(missingFontsOf(page(stack("-apple-system, 'Segoe UI', sans-serif"), text), measure)).toEqual([]);
  });

  it('ignores families only used by elements without text', () => {
    expect(missingFontsOf(page(stack('Brand, serif'), '<div class="t" data-feega-src="p:1:1"></div>'), measure)).toEqual([]);
  });

  it('lists each missing family once', () => {
    const doc = page(stack('Brand, serif'), text + text);

    expect(missingFontsOf(doc, measure)).toHaveLength(1);
  });

  it('keeps the fallback of the first element that uses the family', () => {
    const doc = page('.a { font-family: Brand, sans-serif; } .b { font-family: Brand, serif; }', '<p class="a" data-feega-src="p:1:1">a</p><p class="b" data-feega-src="p:2:1">b</p>');

    expect(missingFontsOf(doc, measure)[0].fallback).toBe('sans-serif');
  });

  it('keeps quiet about a family a Google Fonts stylesheet is still fetching', () => {
    const doc = new JSDOM(`<head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..800&display=swap"><style>${stack('Space Grotesk, sans-serif')}</style></head><body>${text}</body>`).window.document;
    Object.defineProperty(doc, 'fonts', { value: [] });

    expect(missingFontsOf(doc, measure)).toEqual([]);
  });

  it('reports a Google family once its face failed', () => {
    const doc = new JSDOM(`<head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk"><style>${stack('Space Grotesk, sans-serif')}</style></head><body>${text}</body>`).window.document;
    Object.defineProperty(doc, 'fonts', { value: [{ family: 'Space Grotesk', status: 'error' }] });

    expect(missingFontsOf(doc, measure)).toHaveLength(1);
  });

  it('reports nothing when text cannot be measured', () => {
    expect(missingFontsOf(page(stack('Brand, serif'), text), null)).toEqual([]);
  });
});
