import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { DARK_TAGS_COMPONENT, DARK_TAGS_FONTS, DARK_TAGS_PROPS, DARK_TAGS_VAR_PREFIX, darkTagsComponent } from './component';

export const DARK_TAGS_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-dark-tags`;
export const DARK_TAGS_CLIP = 'poster';
export const DARK_TAGS_KEY_FIELDS = ['title', 'tags', 'marker', 'index', 'title_color'];
const DARK_TAGS_GRAIN = 0.05;

export const DARK_TAGS_POSTER_TEMPLATE: TemplateEntry = {
  id: DARK_TAGS_TEMPLATE_ID,
  template: {
    name: 'Poster dark tags',
    description: 'A dark grey poster: a huge light grey heavy multi-line title filling the page, small coloured name tags scattered across it, a framed mark and a small index line.',
    keyFields: DARK_TAGS_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-dark-tags', component: DARK_TAGS_COMPONENT, code: darkTagsComponent(), props: DARK_TAGS_PROPS, fonts: DARK_TAGS_FONTS, varPrefix: DARK_TAGS_VAR_PREFIX, vars: [], clip: DARK_TAGS_CLIP }, DARK_TAGS_GRAIN)
  }
};
