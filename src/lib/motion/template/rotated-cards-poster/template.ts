import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { ROTATED_CARDS_COMPONENT, ROTATED_CARDS_FONTS, ROTATED_CARDS_PROPS, ROTATED_CARDS_VAR_PREFIX, rotatedCardsComponent } from './component';

export const ROTATED_CARDS_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-rotated-cards`;
export const ROTATED_CARDS_CLIP = 'poster';
export const ROTATED_CARDS_KEY_FIELDS = ['title', 'cards', 'year_tag', 'wordmark', 'marker'];
const ROTATED_CARDS_GRAIN = 0.02;

export const ROTATED_CARDS_POSTER_TEMPLATE: TemplateEntry = {
  id: ROTATED_CARDS_TEMPLATE_ID,
  template: {
    name: 'Poster rotated cards',
    description: 'A white poster: a big serif title over a scatter of slightly rotated colour cards, each with a lighter left edge, a date, a hashtag tag and a name, plus a year tag and a wordmark at the foot.',
    keyFields: ROTATED_CARDS_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-rotated-cards', component: ROTATED_CARDS_COMPONENT, code: rotatedCardsComponent(), props: ROTATED_CARDS_PROPS, fonts: ROTATED_CARDS_FONTS, varPrefix: ROTATED_CARDS_VAR_PREFIX, vars: [], clip: ROTATED_CARDS_CLIP }, ROTATED_CARDS_GRAIN)
  }
};
