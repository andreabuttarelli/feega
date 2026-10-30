import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SHEET_PAGE_LOADERS, settingsPageLoader, settingsSectionOf, settingsSheetSection } from './sheet-pages';

describe('settingsSectionOf: quale cartella sotto settings/ risponde a questo path', () => {
  it('la radice di settings apre il progetto', () => {
    expect(settingsSectionOf('/settings')).toBe('project');
    expect(settingsSectionOf('/settings/')).toBe('project');
  });

  it('ogni sezione usa il suo primo segmento', () => {
    expect(settingsSectionOf('/settings/brand')).toBe('brand');
    expect(settingsSectionOf('/settings/api-keys')).toBe('api-keys');
  });

  it('una sottopagina di una sezione resta nella sezione', () => {
    expect(settingsSectionOf('/settings/brand/logo')).toBe('brand');
  });
});

describe('settingsPageLoader: la sezione trova la sua pagina reale', () => {
  it('ogni sezione esistente sotto settings/ ha un loader', () => {
    for (const section of ['brand', 'api-keys', 'team', 'profile', 'appearance', 'danger', 'products']) {
      expect(settingsPageLoader(`/settings/${section}`), `manca la pagina per ${section}`).not.toBeNull();
    }
  });

  it('una sezione inesistente non trova niente', () => {
    expect(settingsPageLoader('/settings/does-not-exist')).toBeNull();
  });

  it('la radice di settings trova la stessa pagina del progetto', () => {
    expect(settingsPageLoader('/settings')).toBe(settingsPageLoader('/settings/project'));
  });
});

describe('SHEET_PAGE_LOADERS: il foglio scarica le sue pagine solo quando si apre', () => {
  it('il guscio di settings è un modulo pigro, non un import statico della tela', async () => {
    expect((await SHEET_PAGE_LOADERS.settingsLayout()).default).toBeTruthy();
  });
});

describe('settingsSheetSection: la pagina arriva insieme ai dati della sua sezione', () => {
  it('la pagina delle spese non riceve mai i dati dei font', async () => {
    const [spend, fonts] = await Promise.all([
      settingsSheetSection('/settings/spend', { caps: [] }),
      settingsSheetSection('/settings/fonts', { fonts: [] })
    ]);

    expect(spend?.data).toEqual({ caps: [] });
    expect(spend?.Page).toBe((await settingsPageLoader('/settings/spend')!()).default);
    expect(fonts?.data).toEqual({ fonts: [] });
  });

  it('una sezione inesistente non trova niente', () => {
    expect(settingsSheetSection('/settings/does-not-exist', {})).toBeNull();
  });

  it('il foglio passa alla pagina i dati risolti con lei, non quelli correnti del foglio', () => {
    const sheet = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../components/canvas/CanvasSheet.svelte'), 'utf8');
    expect(sheet).not.toMatch(/<SettingsSectionPage[^>]*sheet\.data/);
    expect(sheet).toContain('settingsSheetSection(');
  });
});
