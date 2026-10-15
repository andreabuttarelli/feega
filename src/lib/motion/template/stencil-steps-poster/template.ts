import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { STENCIL_STEPS_COMPONENT, STENCIL_STEPS_FONTS, STENCIL_STEPS_PROPS, STENCIL_STEPS_VAR_PREFIX, stencilStepsComponent } from './component';

export const STENCIL_STEPS_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-stencil-steps`;
export const STENCIL_STEPS_CLIP = 'poster';
export const STENCIL_STEPS_KEY_FIELDS = ['syllables', 'rects', 'title', 'dates', 'marker'];
const STENCIL_STEPS_GRAIN = 0.03;

export const STENCIL_STEPS_POSTER_TEMPLATE: TemplateEntry = {
  id: STENCIL_STEPS_TEMPLATE_ID,
  template: {
    name: 'Poster stencil steps',
    description: 'A white festival poster: fluorescent green and magenta stepped rectangles, heavy stencil-cut syllables stacked down the page, and black label tags for the title, dates, links and programme.',
    keyFields: STENCIL_STEPS_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-stencil-steps', component: STENCIL_STEPS_COMPONENT, code: stencilStepsComponent(), props: STENCIL_STEPS_PROPS, fonts: STENCIL_STEPS_FONTS, varPrefix: STENCIL_STEPS_VAR_PREFIX, vars: [], clip: STENCIL_STEPS_CLIP }, STENCIL_STEPS_GRAIN)
  }
};
