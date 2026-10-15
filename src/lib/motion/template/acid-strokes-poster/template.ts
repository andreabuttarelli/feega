import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { ACID_STROKES_COMPONENT, ACID_STROKES_FONTS, ACID_STROKES_PROPS, ACID_STROKES_VAR_PREFIX, acidStrokesComponent } from './component';

export const ACID_STROKES_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-acid-strokes`;
export const ACID_STROKES_CLIP = 'poster';
export const ACID_STROKES_KEY_FIELDS = ['title', 'script', 'strokes', 'venue', 'marker'];
const ACID_STROKES_GRAIN = 0.06;

export const ACID_STROKES_POSTER_TEMPLATE: TemplateEntry = {
  id: ACID_STROKES_TEMPLATE_ID,
  template: {
    name: 'Poster acid strokes',
    description: 'An acid green exhibition poster: black calligraphic brush strokes around the edges, spiky starbursts and an oval, a centred grotesk title with a script word, dates running down the side.',
    keyFields: ACID_STROKES_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-acid-strokes', component: ACID_STROKES_COMPONENT, code: acidStrokesComponent(), props: ACID_STROKES_PROPS, fonts: ACID_STROKES_FONTS, varPrefix: ACID_STROKES_VAR_PREFIX, vars: [], clip: ACID_STROKES_CLIP }, ACID_STROKES_GRAIN)
  }
};
