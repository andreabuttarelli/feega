import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { STACKED_PLUS_COMPONENT, STACKED_PLUS_FONTS, STACKED_PLUS_PROPS, STACKED_PLUS_VAR_PREFIX, stackedPlusComponent } from './component';

export const STACKED_PLUS_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-stacked-plus`;
export const STACKED_PLUS_CLIP = 'poster';
export const STACKED_PLUS_KEY_FIELDS = ['rows', 'marker', 'index', 'rows_color', 'plus_color'];
const STACKED_PLUS_GRAIN = 0.03;

export const STACKED_PLUS_POSTER_TEMPLATE: TemplateEntry = {
  id: STACKED_PLUS_TEMPLATE_ID,
  template: {
    name: 'Poster stacked plus',
    description: 'An off-white poster: huge heavy lowercase words stacked, each wedged against a small paragraph, with a yellow plus, a blue quarter circle and an orange rectangle around them.',
    keyFields: STACKED_PLUS_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-stacked-plus', component: STACKED_PLUS_COMPONENT, code: stackedPlusComponent(), props: STACKED_PLUS_PROPS, fonts: STACKED_PLUS_FONTS, varPrefix: STACKED_PLUS_VAR_PREFIX, vars: [], clip: STACKED_PLUS_CLIP }, STACKED_PLUS_GRAIN)
  }
};
