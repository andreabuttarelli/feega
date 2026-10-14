import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { SCATTERED_TYPE_COMPONENT, SCATTERED_TYPE_FONTS, SCATTERED_TYPE_PROPS, SCATTERED_TYPE_VAR_PREFIX, scatteredTypeComponent } from './component';

export const SCATTERED_TYPE_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-scattered-type`;
export const SCATTERED_TYPE_CLIP = 'poster';
export const SCATTERED_TYPE_KEY_FIELDS = ['dates', 'blocks', 'photos', 'time', 'font'];
const SCATTERED_TYPE_GRAIN = 0.04;

export const SCATTERED_TYPE_POSTER_TEMPLATE: TemplateEntry = {
  id: SCATTERED_TYPE_TEMPLATE_ID,
  template: {
    name: 'Poster scattered type',
    description: 'An open studio poster on light grey: big dates top left, medium grotesk text blocks scattered and some turned on their side, photos of different sizes, black % tags, a huge time range overlapping the last photo and a black label at the foot.',
    keyFields: SCATTERED_TYPE_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-scattered-type', component: SCATTERED_TYPE_COMPONENT, code: scatteredTypeComponent(), props: SCATTERED_TYPE_PROPS, fonts: SCATTERED_TYPE_FONTS, varPrefix: SCATTERED_TYPE_VAR_PREFIX, vars: [], clip: SCATTERED_TYPE_CLIP }, SCATTERED_TYPE_GRAIN)
  }
};
