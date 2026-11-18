import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CANVAS_SETTINGS_GROUPS, SETTINGS_SECTIONS } from './platforms';

const BRAND_PAGE = '../../../routes/app/settings/brands/[brandId]/brand/+page.svelte';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const routeDir = (section: string) =>
  fileURLToPath(new URL(`../../../routes/p/[projectId]/settings/${section}`, import.meta.url));

/**
 * `brands` was cut down to logo, name, slug, website, short description, content — no palette,
 * target audience, voice, hashtags, fonts, platforms, timezone. The routes that edited those
 * fields (and the `people` / talent feature) are gone with the columns; this test keeps them
 * from coming back as a dangling route or a nav entry.
 */
const REMOVED = ['platforms', 'hashtags', 'voice-examples', 'timezone', 'people'];

describe('la pagina brand mostra solo le colonne vere', () => {
  it('non lascia in piedi le rotte delle colonne cancellate', () => {
    for (const section of REMOVED) {
      expect(existsSync(routeDir(section)), `settings/${section} esiste ancora`).toBe(false);
    }
  });

  it('non le lascia nemmeno negli elenchi che disegnano la navigazione', () => {
    const listed = [
      ...SETTINGS_SECTIONS.map((s) => s.path),
      ...CANVAS_SETTINGS_GROUPS.flatMap((g) => g.items.map((i) => i.section))
    ];
    for (const section of REMOVED) {
      expect(listed, `${section} è ancora in nav`).not.toContain(section);
    }
  });

  it('la pagina brand edita solo i campi reali di brands', () => {
    const page = read(BRAND_PAGE);

    for (const field of ['name', 'website', 'short_description', 'content']) {
      expect(page, `manca il campo ${field}`).toContain(`name="${field}"`);
    }
    expect(page).not.toContain('StudioPage');
    expect(page).not.toContain('BrandTimezone');
  });

  it('la pagina brand vive nel dashboard, non nella tela, e non ha uno stato vuoto', () => {
    expect(existsSync(routeDir('brand'))).toBe(false);
    expect(read(BRAND_PAGE)).not.toContain('No brand yet');
  });
});
