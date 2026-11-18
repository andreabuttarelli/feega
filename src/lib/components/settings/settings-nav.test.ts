import { describe, expect, it } from 'vitest';
import { BRAND_SETTINGS_ITEMS, CANVAS_SETTINGS_GROUPS, DASHBOARD_SETTINGS_GROUPS, SETTINGS_SECTIONS } from './platforms';

describe('la tabella di nav delle impostazioni', () => {
  it('la tela raggruppa solo Progetto, il dashboard Account e Workspace', () => {
    expect(CANVAS_SETTINGS_GROUPS.map((g) => g.labelKey)).toEqual(['app.nav.sectionProject']);
    expect(DASHBOARD_SETTINGS_GROUPS.map((g) => g.labelKey)).toEqual(['app.nav.sectionAccount', 'app.nav.workspace']);
  });

  it('il gruppo Progetto contiene la pagina del progetto e i limiti di spesa del progetto', () => {
    expect(CANVAS_SETTINGS_GROUPS[0].items.map((i) => i.section)).toEqual(['project', 'history', 'spend']);
  });

  it('il profilo è la prima voce del dashboard', () => {
    expect(DASHBOARD_SETTINGS_GROUPS[0].items[0].section).toBe('profile');
  });

  it('le sezioni del brand sono le voci di un brand, non di un gruppo statico', () => {
    expect(BRAND_SETTINGS_ITEMS.map((i) => i.section)).toEqual(['brand', 'products', 'video', 'danger']);
  });

  it('ogni sezione compare in una nav almeno', () => {
    const shown = [...CANVAS_SETTINGS_GROUPS, ...DASHBOARD_SETTINGS_GROUPS, { items: BRAND_SETTINGS_ITEMS }].flatMap((g) => g.items.map((i) => i.section));
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
