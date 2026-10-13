import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { SQUARE_WORDS_COMPONENT, SQUARE_WORDS_FONTS, SQUARE_WORDS_PROPS, SQUARE_WORDS_VAR_PREFIX, squareWordsComponent } from './component';

export const SQUARE_WORDS_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-square-words`;
export const SQUARE_WORDS_CLIP = 'poster';
export const SQUARE_WORDS_KEY_FIELDS = ['words', 'body', 'square', 'paper', 'font'];
const SQUARE_WORDS_GRAIN = 0.06;

export const SQUARE_WORDS_POSTER_TEMPLATE: TemplateEntry = {
  id: SQUARE_WORDS_TEMPLATE_ID,
  template: {
    name: 'Poster square words',
    description: 'A studio poster on a soft grey gradient: large words staggered across the page, a red-orange square with a short paragraph hiding some of them, and a black circle with a ring on its edge.',
    keyFields: SQUARE_WORDS_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-square-words', component: SQUARE_WORDS_COMPONENT, code: squareWordsComponent(), props: SQUARE_WORDS_PROPS, fonts: SQUARE_WORDS_FONTS, varPrefix: SQUARE_WORDS_VAR_PREFIX, vars: [], clip: SQUARE_WORDS_CLIP }, SQUARE_WORDS_GRAIN)
  }
};
