import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { MONTH_GRID_COMPONENT, MONTH_GRID_FONTS, MONTH_GRID_PROPS, MONTH_GRID_VAR_PREFIX, monthGridComponent } from './component';

export const MONTH_GRID_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-month-grid`;
export const MONTH_GRID_CLIP = 'poster';
export const MONTH_GRID_KEY_FIELDS = ['label', 'months', 'cards', 'cards_color', 'marker'];
const MONTH_GRID_GRAIN = 0.02;

export const MONTH_GRID_POSTER_TEMPLATE: TemplateEntry = {
  id: MONTH_GRID_TEMPLATE_ID,
  template: {
    name: 'Poster month grid',
    description: 'A white poster: a label on a yellow highlight top left, huge thin month words running down the page, a grid of yellow event cards with a category tag, date, name and venue laid over them.',
    keyFields: MONTH_GRID_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-month-grid', component: MONTH_GRID_COMPONENT, code: monthGridComponent(), props: MONTH_GRID_PROPS, fonts: MONTH_GRID_FONTS, varPrefix: MONTH_GRID_VAR_PREFIX, vars: [], clip: MONTH_GRID_CLIP }, MONTH_GRID_GRAIN)
  }
};
