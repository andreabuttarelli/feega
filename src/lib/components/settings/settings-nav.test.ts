import { describe, expect, it } from 'vitest';
import { SETTINGS_GROUPS, SETTINGS_SECTIONS, sectionRequiresBrand } from './platforms';

describe('la tabella di nav delle impostazioni', () => {
  it('raggruppa per scope nell\'ordine Progetto, Workspace, Brand, Account', () => {
    const labels = SETTINGS_GROUPS.map((g) => g.labelKey);
    expect(labels).toEqual(['app.nav.workspace', 'app.nav.sectionBrand', 'app.nav.sectionAccount']);
  });

  it('omette Progetto: nessuna sezione ha ancora quello scope', () => {
    expect(SETTINGS_GROUPS.some((g) => g.labelKey === 'app.nav.sectionProject')).toBe(false);
  });

  it('mostra gli stessi gruppi con o senza un brand: la nav non dipende dal brand', () => {
    const withBrand = SETTINGS_GROUPS.map((g) => g.items.map((i) => i.section));
    const withoutBrand = SETTINGS_GROUPS.map((g) => g.items.map((i) => i.section));
    expect(withBrand).toEqual(withoutBrand);
  });

  it('non elenca le sotto-rotte come voci separate', () => {
    const sections = SETTINGS_GROUPS.flatMap((g) => g.items.map((i) => i.section));
    expect(sections).not.toContain('facebook');
    expect(sections).not.toContain('linkedin');
    expect(sections).not.toContain('connect/[platform]');
  });
});

describe('sectionRequiresBrand', () => {
  it('richiede un brand per le sezioni brand-scoped', () => {
    for (const s of SETTINGS_SECTIONS.filter((s) => s.scope === 'brand')) {
      expect(sectionRequiresBrand(`/p/proj-1/settings/${s.path}`), s.path).toBe(true);
    }
  });

  it('non richiede un brand per workspace o account', () => {
    for (const s of SETTINGS_SECTIONS.filter((s) => s.scope !== 'brand')) {
      expect(sectionRequiresBrand(`/p/proj-1/settings/${s.path}`), s.path).toBe(false);
    }
  });

  it('ignora uno slash finale', () => {
    expect(sectionRequiresBrand('/p/proj-1/settings/video/')).toBe(true);
  });
});
