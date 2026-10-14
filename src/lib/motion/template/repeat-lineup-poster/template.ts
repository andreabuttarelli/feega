import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { REPEAT_LINEUP_COMPONENT, REPEAT_LINEUP_FONTS, REPEAT_LINEUP_PROPS, REPEAT_LINEUP_VAR_PREFIX, repeatLineupComponent } from './component';

export const REPEAT_LINEUP_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-repeat-lineup`;
export const REPEAT_LINEUP_CLIP = 'poster';
export const REPEAT_LINEUP_KEY_FIELDS = ['lineup', 'info', 'blocks', 'font'];
const REPEAT_LINEUP_GRAIN = 0.05;

export const REPEAT_LINEUP_POSTER_TEMPLATE: TemplateEntry = {
  id: REPEAT_LINEUP_TEMPLATE_ID,
  template: {
    name: 'Poster repeat lineup',
    description: 'A club night poster on off-white: a three-line bold line-up on grey highlight boxes repeated down the page over acid blocks, grey bars, thin construction lines, dashed circles and ellipses, with the date, venue and time row between repeats.',
    keyFields: REPEAT_LINEUP_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-repeat-lineup', component: REPEAT_LINEUP_COMPONENT, code: repeatLineupComponent(), props: REPEAT_LINEUP_PROPS, fonts: REPEAT_LINEUP_FONTS, varPrefix: REPEAT_LINEUP_VAR_PREFIX, vars: [], clip: REPEAT_LINEUP_CLIP }, REPEAT_LINEUP_GRAIN)
  }
};
