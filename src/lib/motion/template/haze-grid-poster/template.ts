import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { HAZE_GRID_COMPONENT, HAZE_GRID_FONTS, HAZE_GRID_PROPS, HAZE_GRID_VAR_PREFIX, hazeGridComponent } from './component';

export const HAZE_GRID_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-haze-grid`;
export const HAZE_GRID_CLIP = 'poster';
export const HAZE_GRID_KEY_FIELDS = ['rows', 'note', 'body', 'marker', 'issue'];
const HAZE_GRID_GRAIN = 0.045;

export const HAZE_GRID_POSTER_TEMPLATE: TemplateEntry = {
  id: HAZE_GRID_TEMPLATE_ID,
  template: {
    name: 'Poster haze grid',
    description: 'A blue-black gradient with a soft haze low left: a huge light wordmark stacked on a fine guide grid, numbered superscripts after each word, a small note and a paragraph in the lower right.',
    keyFields: HAZE_GRID_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-haze-grid', component: HAZE_GRID_COMPONENT, code: hazeGridComponent(), props: HAZE_GRID_PROPS, fonts: HAZE_GRID_FONTS, varPrefix: HAZE_GRID_VAR_PREFIX, vars: [], clip: HAZE_GRID_CLIP }, HAZE_GRID_GRAIN)
  }
};
