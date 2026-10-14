import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { FESTIVAL_GRID_COMPONENT, FESTIVAL_GRID_FONTS, FESTIVAL_GRID_PROPS, FESTIVAL_GRID_VAR_PREFIX, festivalGridComponent } from './component';

export const FESTIVAL_GRID_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-festival-grid`;
export const FESTIVAL_GRID_CLIP = 'poster';
export const FESTIVAL_GRID_KEY_FIELDS = ['title', 'photos', 'edition', 'programme1', 'font'];
const FESTIVAL_GRID_GRAIN = 0.03;

export const FESTIVAL_GRID_POSTER_TEMPLATE: TemplateEntry = {
  id: FESTIVAL_GRID_TEMPLATE_ID,
  template: {
    name: 'Poster festival grid',
    description: 'A festival poster on a visible thin grid: a big geometric title and year top right, black dots down the left rule, long arrows crossing a photo cell, edition and venue with dash rules, a three-column programme and a row of partner marks, with an accent number cell.',
    keyFields: FESTIVAL_GRID_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-festival-grid', component: FESTIVAL_GRID_COMPONENT, code: festivalGridComponent(), props: FESTIVAL_GRID_PROPS, fonts: FESTIVAL_GRID_FONTS, varPrefix: FESTIVAL_GRID_VAR_PREFIX, vars: [], clip: FESTIVAL_GRID_CLIP }, FESTIVAL_GRID_GRAIN)
  }
};
