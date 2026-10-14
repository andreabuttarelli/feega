import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { SLICED_PHOTO_COMPONENT, SLICED_PHOTO_FONTS, SLICED_PHOTO_PROPS, SLICED_PHOTO_VAR_PREFIX, slicedPhotoComponent } from './component';

export const SLICED_PHOTO_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-sliced-photo`;
export const SLICED_PHOTO_CLIP = 'poster';
export const SLICED_PHOTO_KEY_FIELDS = ['phrases', 'photos', 'strips', 'paper', 'font'];
const SLICED_PHOTO_GRAIN = 0.16;

export const SLICED_PHOTO_POSTER_TEMPLATE: TemplateEntry = {
  id: SLICED_PHOTO_TEMPLATE_ID,
  template: {
    name: 'Poster sliced photo',
    description: 'A grainy orange poster: a black and white photo cut into vertical strips shifted up and down, thin white lines between them, six caps phrases at the corners and the middle, a tiny code block and a numbered ring.',
    keyFields: SLICED_PHOTO_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-sliced-photo', component: SLICED_PHOTO_COMPONENT, code: slicedPhotoComponent(), props: SLICED_PHOTO_PROPS, fonts: SLICED_PHOTO_FONTS, varPrefix: SLICED_PHOTO_VAR_PREFIX, vars: [], clip: SLICED_PHOTO_CLIP }, SLICED_PHOTO_GRAIN)
  }
};
