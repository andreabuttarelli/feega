import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { CHECKER_COMPONENT, CHECKER_FONTS, CHECKER_PROPS, CHECKER_VAR_PREFIX, checkerComponent } from './component';

export const CHECKER_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-checker-steps`;
export const CHECKER_CLIP = 'poster';
export const CHECKER_KEY_FIELDS = ['title', 'body', 'checker', 'ink', 'font'];
const CHECKER_GRAIN = 0.1;

export const CHECKER_STEPS_POSTER_TEMPLATE: TemplateEntry = {
  id: CHECKER_TEMPLATE_ID,
  template: {
    name: 'Poster checker steps',
    description: 'A worn blue and white checker climbing as a staircase, a big black title set one word per step, and a small text block under a blue bar top right.',
    keyFields: CHECKER_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-checker-steps', component: CHECKER_COMPONENT, code: checkerComponent(), props: CHECKER_PROPS, fonts: CHECKER_FONTS, varPrefix: CHECKER_VAR_PREFIX, vars: [], clip: CHECKER_CLIP }, CHECKER_GRAIN)
  }
};
