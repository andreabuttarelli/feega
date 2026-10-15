import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { BLUE_TRAILS_COMPONENT, BLUE_TRAILS_FONTS, BLUE_TRAILS_PROPS, BLUE_TRAILS_VAR_PREFIX, blueTrailsComponent } from './component';

export const BLUE_TRAILS_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-blue-trails`;
export const BLUE_TRAILS_CLIP = 'poster';
export const BLUE_TRAILS_KEY_FIELDS = ['title', 'dots', 'dots_color', 'marker', 'index'];
const BLUE_TRAILS_GRAIN = 0.16;

export const BLUE_TRAILS_POSTER_TEMPLATE: TemplateEntry = {
  id: BLUE_TRAILS_TEMPLATE_ID,
  template: {
    name: 'Poster blue trails',
    description: 'A grainy black poster: rows of electric blue dots trailing horizontal gradient tails, a few words set over them, a two-line title shifted right and four corner lines.',
    keyFields: BLUE_TRAILS_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-blue-trails', component: BLUE_TRAILS_COMPONENT, code: blueTrailsComponent(), props: BLUE_TRAILS_PROPS, fonts: BLUE_TRAILS_FONTS, varPrefix: BLUE_TRAILS_VAR_PREFIX, vars: [], clip: BLUE_TRAILS_CLIP }, BLUE_TRAILS_GRAIN)
  }
};
