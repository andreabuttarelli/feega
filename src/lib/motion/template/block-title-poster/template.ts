import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { BLOCK_TITLE_COMPONENT, BLOCK_TITLE_FONTS, BLOCK_TITLE_PROPS, BLOCK_TITLE_VAR_PREFIX, blockTitleComponent } from './component';

export const BLOCK_TITLE_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-block-title`;
export const BLOCK_TITLE_CLIP = 'poster';
export const BLOCK_TITLE_KEY_FIELDS = ['title', 'byline', 'names', 'block', 'font'];
const BLOCK_TITLE_GRAIN = 0.1;

export const BLOCK_TITLE_POSTER_TEMPLATE: TemplateEntry = {
  id: BLOCK_TITLE_TEMPLATE_ID,
  template: {
    name: 'Poster block title',
    description: 'A film poster on worn off-white paper: a huge heavy lowercase title, a violet block rising into its last line, a row of four names over a rule and a short paragraph.',
    keyFields: BLOCK_TITLE_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-block-title', component: BLOCK_TITLE_COMPONENT, code: blockTitleComponent(), props: BLOCK_TITLE_PROPS, fonts: BLOCK_TITLE_FONTS, varPrefix: BLOCK_TITLE_VAR_PREFIX, vars: [], clip: BLOCK_TITLE_CLIP }, BLOCK_TITLE_GRAIN)
  }
};
