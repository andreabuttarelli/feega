import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { BOXED_TYPE_COMPONENT, BOXED_TYPE_FONTS, BOXED_TYPE_PROPS, BOXED_TYPE_VAR_PREFIX, boxedTypeComponent } from './component';

export const BOXED_TYPE_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-boxed-type`;
export const BOXED_TYPE_CLIP = 'poster';
export const BOXED_TYPE_KEY_FIELDS = ['title', 'word', 'statement', 'rule', 'font'];
const BOXED_TYPE_GRAIN = 0.16;

export const BOXED_TYPE_POSTER_TEMPLATE: TemplateEntry = {
  id: BOXED_TYPE_TEMPLATE_ID,
  template: {
    name: 'Poster boxed type',
    description: 'A grainy grey type poster: a red top rule, small black tags top and bottom, a big title stepping on grey boxes, one huge white word in a black box and a capitals statement on white boxes.',
    keyFields: BOXED_TYPE_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-boxed-type', component: BOXED_TYPE_COMPONENT, code: boxedTypeComponent(), props: BOXED_TYPE_PROPS, fonts: BOXED_TYPE_FONTS, varPrefix: BOXED_TYPE_VAR_PREFIX, vars: [], clip: BOXED_TYPE_CLIP }, BOXED_TYPE_GRAIN)
  }
};
