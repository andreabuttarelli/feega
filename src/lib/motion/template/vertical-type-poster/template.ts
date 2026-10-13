import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { VERTICAL_TYPE_COMPONENT, VERTICAL_TYPE_FONTS, VERTICAL_TYPE_PROPS, VERTICAL_TYPE_VAR_PREFIX, verticalTypeComponent } from './component';

export const VERTICAL_TYPE_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-vertical-type`;
export const VERTICAL_TYPE_CLIP = 'poster';
export const VERTICAL_TYPE_KEY_FIELDS = ['words', 'photos', 'list', 'accent', 'font'];
const VERTICAL_TYPE_GRAIN = 0.06;

export const VERTICAL_TYPE_POSTER_TEMPLATE: TemplateEntry = {
  id: VERTICAL_TYPE_TEMPLATE_ID,
  template: {
    name: 'Poster vertical type',
    description: 'A menu poster on a white grid of thin rules: huge words in pixel type running up the columns, solid black cells, a big grainy black and white photo and a two-column list at the foot, with one accent cell and a numbered tab.',
    keyFields: VERTICAL_TYPE_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-vertical-type', component: VERTICAL_TYPE_COMPONENT, code: verticalTypeComponent(), props: VERTICAL_TYPE_PROPS, fonts: VERTICAL_TYPE_FONTS, varPrefix: VERTICAL_TYPE_VAR_PREFIX, vars: [], clip: VERTICAL_TYPE_CLIP }, VERTICAL_TYPE_GRAIN)
  }
};
