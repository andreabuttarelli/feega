import { describe, expect, it } from 'vitest';
import { NAV_ENTRIES, navEntriesByGroup, navHref, sheetEntryForPath, BURGER_ENTRIES, mobileNavHref, directLoadMode } from './shell-nav';

describe('la rail: due gruppi, un comportamento a testa', () => {
  it('il gruppo "panel" è Assets, Brands e Influencers, in quest\'ordine', () => {
    expect(navEntriesByGroup('panel').map((e) => e.id)).toEqual(['assets', 'brands', 'influencers']);
  });

  it('il gruppo "workbench" è Calendar, Ads, Studio, Settings, in quest\'ordine', () => {
    expect(navEntriesByGroup('workbench').map((e) => e.id)).toEqual(['calendar', 'ads', 'studio', 'settings']);
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
    expect(sheetEntryForPath('/calendar')?.id).toBe('calendar');
    expect(sheetEntryForPath('/ads')?.id).toBe('ads');
    expect(sheetEntryForPath('/settings/connected-accounts')?.id).toBe('settings');
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
    expect(sheetEntryForPath('/calendar/')?.id).toBe('calendar');
  });
});

describe('il burger mobile legge la stessa tabella della rail', () => {
  it('offre ogni voce della rail, nello stesso ordine', () => {
    const rail = [...navEntriesByGroup('panel'), ...navEntriesByGroup('workbench')];
    expect(BURGER_ENTRIES.map((e) => e.id)).toEqual(rail.map((e) => e.id));
  });
});

describe('un foglio si riconosce anche con parametri nell\'indirizzo', () => {
  it('/promote?nodeIds=… apre il foglio Promote', () => {
    expect(sheetEntryForPath('/promote?nodeIds=a,b&tab=paid')?.id).toBe('promote');
  });

  it('un frammento non cambia il foglio', () => {
    expect(sheetEntryForPath('/calendar#oggi')?.id).toBe('calendar');
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
  const cases: Array<[string, string, 'mobile' | 'desktop', 'sheet' | 'page']> = [
    ['/calendar', '', 'desktop', 'sheet'],
    ['/calendar', '?month=2026-10', 'desktop', 'sheet'],
    ['/ads', '', 'desktop', 'sheet'],
    ['/promote', '', 'desktop', 'sheet'],
    ['/settings/billing', '', 'desktop', 'sheet'],
    ['/settings/connected-accounts', '', 'desktop', 'sheet'],
    ['/settings/connected-accounts', '?connected=instagram', 'desktop', 'page'],
    ['/settings/facebook', '?tempToken=x', 'desktop', 'page'],
    ['/settings/linkedin', '', 'desktop', 'page'],
    ['/settings/connect/instagram', '', 'desktop', 'page'],
    ['/calendar', '', 'mobile', 'page'],
    ['/settings/billing', '', 'mobile', 'page'],
    ['/assets', '', 'desktop', 'page'],
    ['/brands/new', '', 'desktop', 'page'],
    ['/c/abc', '', 'desktop', 'page'],
    ['/studio', '', 'desktop', 'page']
  ];

  it.each(cases)('%s%s su %s → %s', (path, search, viewport, expected) => {
    expect(directLoadMode(path, search, viewport)).toBe(expected);
  });
});
