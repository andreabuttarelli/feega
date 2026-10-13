import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { PHOTO_GRID_COMPONENT, PHOTO_GRID_FONTS, PHOTO_GRID_PROPS, PHOTO_GRID_VAR_PREFIX, photoGridComponent } from './component';

export const PHOTO_GRID_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-photo-grid`;
export const PHOTO_GRID_CLIP = 'poster';
export const PHOTO_GRID_KEY_FIELDS = ['title', 'photos', 'tiles', 'accent', 'font'];
const PHOTO_GRID_GRAIN = 0.03;

export const PHOTO_GRID_POSTER_TEMPLATE: TemplateEntry = {
  id: PHOTO_GRID_TEMPLATE_ID,
  template: {
    name: 'Poster photo grid',
    description: 'A title poster on a fine square grid: a huge letterspaced six-line title, black and white photo tiles snapped to cells over and under it and scattered down the page, small caps text blocks, coordinates on the right edge and a blue counter cell.',
    keyFields: PHOTO_GRID_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-photo-grid', component: PHOTO_GRID_COMPONENT, code: photoGridComponent(), props: PHOTO_GRID_PROPS, fonts: PHOTO_GRID_FONTS, varPrefix: PHOTO_GRID_VAR_PREFIX, vars: [], clip: PHOTO_GRID_CLIP }, PHOTO_GRID_GRAIN)
  }
};
