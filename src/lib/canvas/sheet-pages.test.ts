import { describe, expect, it } from 'vitest';
import { SHEET_PAGE_LOADERS, settingsPageLoader, settingsSectionOf } from './sheet-pages';

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
