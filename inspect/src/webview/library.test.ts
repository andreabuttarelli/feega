import { describe, expect, it } from 'vitest';
import type { LibraryEntry } from '../messages';
import { LibraryTab, LibraryTheme, framedPage, scaleFor, visible } from './library';

const entry = (id: string, category: string, tags: string[] = [], description = ''): LibraryEntry => ({ id, name: id.replace('-', ' '), description, category, tags, tier: 'free', page: '<!doctype html><html><head></head><body></body></html>' });

const ITEMS = [entry('hero-split', 'section', ['hero']), entry('pricing', 'section', ['plans'], 'Three tiers'), entry('badge-set', 'component', ['label']), entry('settings-page', 'app', ['form'])];

describe('visible', () => {
  it('keeps the items of the tab', () => {
    expect(visible(ITEMS, LibraryTab.Sections, '').map((i) => i.id)).toEqual(['hero-split', 'pricing']);
    expect(visible(ITEMS, LibraryTab.Components, '').map((i) => i.id)).toEqual(['badge-set']);
    expect(visible(ITEMS, LibraryTab.App, '').map((i) => i.id)).toEqual(['settings-page']);
  });

  it('searches name, tags and description across every tab', () => {
    expect(visible(ITEMS, LibraryTab.Sections, 'hero').map((i) => i.id)).toEqual(['hero-split']);
    expect(visible(ITEMS, LibraryTab.Sections, 'PLANS').map((i) => i.id)).toEqual(['pricing']);
    expect(visible(ITEMS, LibraryTab.Sections, 'tiers').map((i) => i.id)).toEqual(['pricing']);
    expect(visible(ITEMS, LibraryTab.Sections, 'form').map((i) => i.id)).toEqual(['settings-page']);
  });

  it('ignores surrounding spaces in the query', () => {
    expect(visible(ITEMS, LibraryTab.Sections, '  pricing ').map((i) => i.id)).toEqual(['pricing']);
  });
});

describe('framedPage', () => {
  it('forces the theme on the page root', () => {
    expect(framedPage(ITEMS[0], LibraryTheme.Dark)).toContain('<html data-theme="dark">');
    expect(framedPage(ITEMS[0], LibraryTheme.Light)).toContain('<html data-theme="light">');
  });
});

describe('scaleFor', () => {
  it('shrinks the desktop page to the card width', () => {
    expect(scaleFor(320)).toBe(0.25);
    expect(scaleFor(0)).toBe(0);
  });
});
