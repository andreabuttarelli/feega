import { describe, expect, it } from 'vitest';
import { desktopNav, inLibrary, LIBRARY_ITEMS } from './library-menu';
import { HEADER_LINKS } from './links';

describe('the library nav item', () => {
  it('replaces templates and plugins on desktop with one entry', () => {
    const labels = desktopNav.map((e) => ('library' in e ? 'library' : e.label));

    expect(labels).toEqual(['Download', 'library', 'Docs', 'Blog', 'Pricing', 'Community']);
  });

  it('keeps templates and plugins as separate mobile links', () => {
    const labels = HEADER_LINKS.map((l) => l.label);

    expect(labels).toContain('Templates');
    expect(labels).toContain('Plugins');
  });

  it('is active on templates and plugins pages only', () => {
    expect(inLibrary('/templates')).toBe(true);
    expect(inLibrary('/templates/hero-1')).toBe(true);
    expect(inLibrary('/plugins/x')).toBe(true);
    expect(inLibrary('/pricing')).toBe(false);
    expect(inLibrary('/templatesque')).toBe(false);
  });

  it('describes templates with the free count', () => {
    expect(LIBRARY_ITEMS[0].describe(61)).toBe('free sections and components for Svelte, React, Vue and Astro');
  });
});
