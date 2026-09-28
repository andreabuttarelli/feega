import { describe, expect, it } from 'vitest';
import { NAV_ENTRIES, navEntriesByGroup, navHref, sheetEntryForPath, MOBILE_TABS, MOBILE_MORE_ENTRIES, activeMobileTab, mobileTabHref, mobileNavHref } from './shell-nav';

describe('la rail: due gruppi, un comportamento a testa', () => {
  it('il gruppo "panel" è Assets, Brands e Influencers, in quest\'ordine', () => {
    expect(navEntriesByGroup('panel').map((e) => e.id)).toEqual(['assets', 'brands', 'influencers']);
  });

  it('il gruppo "workbench" è Calendar, Ads, Settings, in quest\'ordine', () => {
    expect(navEntriesByGroup('workbench').map((e) => e.id)).toEqual(['calendar', 'ads', 'settings']);
  });

  it('ogni voce del gruppo panel apre un pannello, ogni voce workbench un foglio', () => {
    for (const entry of navEntriesByGroup('panel')) {
      expect(entry.family).toBe('panel');
    }
    for (const entry of navEntriesByGroup('workbench')) {
      expect(entry.family).toBe('sheet');
    }
  });

  it('navHref antepone il progetto al path della voce', () => {
    expect(navHref('proj1', NAV_ENTRIES[0])).toBe('/p/proj1/assets');
  });
});

describe('sheetEntryForPath: quale voce apre il foglio', () => {
  it('un path esatto apre il suo foglio', () => {
    expect(sheetEntryForPath('/calendar')?.id).toBe('calendar');
    expect(sheetEntryForPath('/ads/social')?.id).toBe('ads');
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

describe('la barra mobile', () => {
  it('ha quattro voci fisse, Canvas · Chat · Calendar · More', () => {
    expect(MOBILE_TABS.map((t) => t.id)).toEqual(['canvas', 'chat', 'calendar', 'more']);
  });

  it('"More" raccoglie tutto tranne Calendar, che ha già la sua voce', () => {
    expect(MOBILE_MORE_ENTRIES.map((e) => e.id)).toEqual(['assets', 'brands', 'influencers', 'ads', 'settings']);
  });
});

describe('un foglio si riconosce anche con parametri nell\'indirizzo', () => {
  it('/create-post?nodeIds=… apre il foglio di creazione post', () => {
    expect(sheetEntryForPath('/create-post?nodeIds=a,b')?.id).toBe('create-post');
  });

  it('un frammento non cambia il foglio', () => {
    expect(sheetEntryForPath('/calendar#oggi')?.id).toBe('calendar');
  });
});

describe('la barra mobile sa quale voce è accesa su ogni pagina', () => {
  it.each([
    ['/p/x/c/y', 'page', 'canvas'],
    ['/p/x/c/y', 'chat', 'chat'],
    ['/p/x/calendar', 'page', 'calendar'],
    ['/p/x/calendar', 'chat', 'chat'],
    ['/p/x/assets', 'page', 'more'],
    ['/p/x/settings/team', 'page', 'more'],
    ['/p/x/brands/acme', 'page', 'more']
  ] as const)('%s con vista %s → %s', (path, view, tab) => {
    expect(activeMobileTab('x', path, view)).toBe(tab);
  });

  it('Canvas porta alla home del progetto, Calendar alla sua pagina, Chat e More restano sul posto', () => {
    expect(MOBILE_TABS.map((t) => mobileTabHref('x', t))).toEqual(['/p/x', null, '/p/x/calendar', null]);
  });
});

describe('More su mobile', () => {
  it('Settings apre l\'elenco delle sezioni, non una sezione a caso', () => {
    const settings = MOBILE_MORE_ENTRIES.find((e) => e.id === 'settings')!;
    expect(mobileNavHref('x', settings)).toBe('/p/x/settings');
  });

  it('le altre voci vanno dove va la rail', () => {
    const assets = MOBILE_MORE_ENTRIES.find((e) => e.id === 'assets')!;
    expect(mobileNavHref('x', assets)).toBe('/p/x/assets');
  });
});
