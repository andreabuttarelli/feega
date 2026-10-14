import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { CURATED_BOARD_COMPONENT, CURATED_BOARD_FONTS, CURATED_BOARD_PROPS, CURATED_BOARD_VAR_PREFIX, curatedBoardComponent } from './component';

export const CURATED_BOARD_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-curated-board`;
export const CURATED_BOARD_CLIP = 'poster';
export const CURATED_BOARD_KEY_FIELDS = ['title', 'tags', 'photos', 'captions', 'font'];
const CURATED_BOARD_GRAIN = 0.03;

export const CURATED_BOARD_POSTER_TEMPLATE: TemplateEntry = {
  id: CURATED_BOARD_TEMPLATE_ID,
  template: {
    name: 'Poster curated board',
    description: 'A curated board on light grey: a bold wordmark in the centre with outlined monospace tags, ringed by small poster thumbnails, each with a number and a name underneath, corner lines and a numbered circle.',
    keyFields: CURATED_BOARD_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-curated-board', component: CURATED_BOARD_COMPONENT, code: curatedBoardComponent(), props: CURATED_BOARD_PROPS, fonts: CURATED_BOARD_FONTS, varPrefix: CURATED_BOARD_VAR_PREFIX, vars: [], clip: CURATED_BOARD_CLIP }, CURATED_BOARD_GRAIN)
  }
};
