import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { RED_NUMBER_COMPONENT, RED_NUMBER_FONTS, RED_NUMBER_PROPS, RED_NUMBER_VAR_PREFIX, redNumberComponent } from './component';

export const RED_NUMBER_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-red-number`;
export const RED_NUMBER_CLIP = 'poster';
export const RED_NUMBER_KEY_FIELDS = ['title', 'photos', 'words', 'number', 'tint'];
const RED_NUMBER_GRAIN = 0.07;

export const RED_NUMBER_POSTER_TEMPLATE: TemplateEntry = {
  id: RED_NUMBER_TEMPLATE_ID,
  template: {
    name: 'Poster red number',
    description: 'An editorial poster on white: a small title top left with two justified text columns, a large red duotone photo square with white words at its corners and centre, small side words with dashes and a huge dark grey number overlapping the foot.',
    keyFields: RED_NUMBER_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-red-number', component: RED_NUMBER_COMPONENT, code: redNumberComponent(), props: RED_NUMBER_PROPS, fonts: RED_NUMBER_FONTS, varPrefix: RED_NUMBER_VAR_PREFIX, vars: [], clip: RED_NUMBER_CLIP }, RED_NUMBER_GRAIN)
  }
};
