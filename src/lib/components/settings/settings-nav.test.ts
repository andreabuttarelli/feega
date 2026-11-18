import { describe, expect, it } from 'vitest';
import { CANVAS_SETTINGS_GROUPS, DASHBOARD_SETTINGS_GROUPS, SETTINGS_SECTIONS, sectionRequiresBrand } from './platforms';

describe('la tabella di nav delle impostazioni', () => {
  it('la tela raggruppa Progetto e Brand, il dashboard Account e Workspace', () => {
    expect(CANVAS_SETTINGS_GROUPS.map((g) => g.labelKey)).toEqual(['app.nav.sectionProject', 'app.nav.sectionBrand']);
    expect(DASHBOARD_SETTINGS_GROUPS.map((g) => g.labelKey)).toEqual(['app.nav.sectionAccount', 'app.nav.workspace']);
  });

  it('il gruppo Progetto contiene la pagina del progetto e i limiti di spesa del progetto', () => {
    expect(CANVAS_SETTINGS_GROUPS[0].items.map((i) => i.section)).toEqual(['project', 'spend']);
  });

  it('il profilo è la prima voce del dashboard', () => {
    expect(DASHBOARD_SETTINGS_GROUPS[0].items[0].section).toBe('profile');
  });

  it('ogni sezione compare in una nav almeno', () => {
    const shown = [...CANVAS_SETTINGS_GROUPS, ...DASHBOARD_SETTINGS_GROUPS].flatMap((g) => g.items.map((i) => i.section));
    expect(shown.toSorted()).toEqual([...SETTINGS_SECTIONS.map((s) => s.path), 'spend'].toSorted());
  });

  it('non offre i referral: referrals e referral_codes non esistono nello schema', () => {
    expect(SETTINGS_SECTIONS.map((s) => s.path)).not.toContain('referrals');
  });

  it('non elenca le sotto-rotte come voci separate', () => {
    const sections = [...CANVAS_SETTINGS_GROUPS, ...DASHBOARD_SETTINGS_GROUPS].flatMap((g) => g.items.map((i) => i.section));
    expect(sections).not.toContain('facebook');
    expect(sections).not.toContain('linkedin');
    expect(sections).not.toContain('connect/[platform]');
  });
});

describe('sectionRequiresBrand', () => {
  it('richiede un brand per le sezioni brand-scoped, tranne la pagina brand che lo collega', () => {
    for (const s of SETTINGS_SECTIONS.filter((s) => s.scope === 'brand' && s.path !== 'brand')) {
      expect(sectionRequiresBrand(`/p/proj-1/settings/${s.path}`), s.path).toBe(true);
    }
  });

  it('la pagina brand non chiude il cancello: è lei a collegare o creare il brand', () => {
    expect(sectionRequiresBrand('/p/proj-1/settings/brand')).toBe(false);
  });

  it('non richiede un brand per progetto, workspace o account', () => {
    for (const s of SETTINGS_SECTIONS.filter((s) => s.scope !== 'brand')) {
      expect(sectionRequiresBrand(`/p/proj-1/settings/${s.path}`), s.path).toBe(false);
    }
  });

  it('ignora uno slash finale', () => {
    expect(sectionRequiresBrand('/p/proj-1/settings/video/')).toBe(true);
  });
});
