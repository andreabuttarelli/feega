import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { GLYPH_SPECIMEN_COMPONENT, GLYPH_SPECIMEN_FONTS, GLYPH_SPECIMEN_PROPS, GLYPH_SPECIMEN_VAR_PREFIX, glyphSpecimenComponent } from './component';

export const GLYPH_SPECIMEN_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-glyph-specimen`;
export const GLYPH_SPECIMEN_CLIP = 'poster';
export const GLYPH_SPECIMEN_KEY_FIELDS = ['glyphs', 'chain_color', 'side', 'dates', 'marker'];
const GLYPH_SPECIMEN_GRAIN = 0.05;

export const GLYPH_SPECIMEN_POSTER_TEMPLATE: TemplateEntry = {
  id: GLYPH_SPECIMEN_TEMPLATE_ID,
  template: {
    name: 'Poster glyph specimen',
    description: 'A type specimen poster: giant black glyph crops in a ruled cell grid, a fluorescent blob chain over them, vertical titles and dates, a mono feature list and a big footer.',
    keyFields: GLYPH_SPECIMEN_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-glyph-specimen', component: GLYPH_SPECIMEN_COMPONENT, code: glyphSpecimenComponent(), props: GLYPH_SPECIMEN_PROPS, fonts: GLYPH_SPECIMEN_FONTS, varPrefix: GLYPH_SPECIMEN_VAR_PREFIX, vars: [], clip: GLYPH_SPECIMEN_CLIP }, GLYPH_SPECIMEN_GRAIN)
  }
};
