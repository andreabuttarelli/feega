import { describe, expect, it } from 'vitest';
import { NAV_ENTRIES, navEntriesByGroup, railEntries, navHref, sheetEntryForPath, BURGER_ENTRIES, mobileNavHref, directLoadMode, panelForShortcut } from './shell-nav';

describe('la rail: due gruppi, un comportamento a testa', () => {
  it('the "panel" group is Assets, Brands, Influencers, Components and History, in this order', () => {
    expect(navEntriesByGroup('panel').map((e) => e.id)).toEqual(['assets', 'brands', 'influencers', 'components', 'history']);
  });

  it('the "canvas" group is Layers: a panel beside the canvas, never a burger link to a page that does not exist', () => {
    expect(navEntriesByGroup('canvas').map((e) => [e.id, e.family])).toEqual([['layers', 'panel']]);
    expect(BURGER_ENTRIES.map((e) => e.id)).not.toContain('layers');
  });

  it('the rail leaves the photo studio out, the burger menu still reaches it', () => {
    expect(railEntries('workbench').map((e) => e.id)).toEqual(['settings']);
    expect(BURGER_ENTRIES.map((e) => e.id)).toContain('studio');
  });

  it('every rail panel has an Alt+digit shortcut, in rail order', () => {
    const rail = [...navEntriesByGroup('canvas'), ...navEntriesByGroup('panel')];
    expect(rail.map((e) => e.shortcut)).toEqual(['Alt+1', 'Alt+2', 'Alt+3', 'Alt+4', 'Alt+5', 'Alt+6']);
  });

  it('Alt+digit resolves to the panel that carries it, nothing else does', () => {
    const key = (code: string, altKey = true) => ({ code, altKey, metaKey: false, ctrlKey: false, shiftKey: false }) as KeyboardEvent;
    expect(panelForShortcut(key('Digit1'))?.id).toBe('layers');
    expect(panelForShortcut(key('Digit3'))?.id).toBe('brands');
    expect(panelForShortcut(key('Digit1', false))).toBeNull();
    expect(panelForShortcut(key('Digit9'))).toBeNull();
  });

  it('ogni voce del gruppo panel apre un pannello, ogni voce workbench un foglio o una pagina sua', () => {
    for (const entry of navEntriesByGroup('panel')) {
      expect(entry.family).toBe('panel');
    }
    for (const entry of navEntriesByGroup('workbench')) {
      expect(['sheet', 'route']).toContain(entry.family);
    }
  });

  it('the photo studio is its own page, carrying the project as its source', () => {
    const studio = NAV_ENTRIES.find((e) => e.id === 'studio')!;
    expect(studio.family).toBe('route');
    expect(navHref('proj1', studio)).toBe('/app/studio?project=proj1');
    expect(mobileNavHref('proj1', studio)).toBe('/app/studio?project=proj1');
  });

  it('navHref antepone il progetto al path della voce', () => {
    expect(navHref('proj1', NAV_ENTRIES[0])).toBe('/p/proj1/assets');
  });
});

describe('sheetEntryForPath: quale voce apre il foglio', () => {
  it('un path esatto apre il suo foglio', () => {
    expect(sheetEntryForPath('/settings/project')?.id).toBe('settings');
  });

  it('una sezione diversa dello stesso foglio apre comunque lo stesso foglio', () => {
    expect(sheetEntryForPath('/settings/brand')?.id).toBe('settings');
    expect(sheetEntryForPath('/settings/brand/logo')?.id).toBe('settings');
  });

  it('un path fuori famiglia sheet non apre niente', () => {
    expect(sheetEntryForPath('/c/xyz')).toBeNull();
    expect(sheetEntryForPath('/assets')).toBeNull();
  });

  it('uno slash finale non cambia il verdetto', () => {
    expect(sheetEntryForPath('/settings/')?.id).toBe('settings');
  });
});

describe('il burger mobile legge la stessa tabella della rail', () => {
  it('offre ogni voce della rail, nello stesso ordine', () => {
    const rail = [...navEntriesByGroup('panel'), ...navEntriesByGroup('workbench')];
    expect(BURGER_ENTRIES.map((e) => e.id)).toEqual(rail.map((e) => e.id));
  });
});

describe('un foglio si riconosce anche con parametri nell\'indirizzo', () => {
  it('/settings/billing?x=… apre il foglio Settings', () => {
    expect(sheetEntryForPath('/settings/billing?x=a')?.id).toBe('settings');
  });

  it('un frammento non cambia il foglio', () => {
    expect(sheetEntryForPath('/settings#oggi')?.id).toBe('settings');
  });
});

describe('il burger su mobile', () => {
  it('Settings apre l\'elenco delle sezioni, non una sezione a caso', () => {
    const settings = BURGER_ENTRIES.find((e) => e.id === 'settings')!;
    expect(mobileNavHref('x', settings)).toBe('/p/x/settings');
  });

  it('le altre voci vanno dove va la rail', () => {
    const assets = BURGER_ENTRIES.find((e) => e.id === 'assets')!;
    expect(mobileNavHref('x', assets)).toBe('/p/x/assets');
  });
});

describe('un link diretto a un foglio su desktop apre la tela con il foglio', () => {
  const cases: Array<[string, 'mobile' | 'desktop', 'sheet' | 'page']> = [
    ['/settings/billing', 'desktop', 'sheet'],
    ['/settings/project', 'desktop', 'sheet'],
    ['/settings/billing', 'mobile', 'page'],
    ['/assets', 'desktop', 'page'],
    ['/brands/new', 'desktop', 'page'],
    ['/c/abc', 'desktop', 'page'],
    ['/studio', 'desktop', 'page']
  ];

  it.each(cases)('%s su %s → %s', (path, viewport, expected) => {
    expect(directLoadMode(path, viewport)).toBe(expected);
  });
});
