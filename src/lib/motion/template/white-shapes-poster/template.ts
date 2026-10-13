import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { WHITE_SHAPES_COMPONENT, WHITE_SHAPES_FONTS, WHITE_SHAPES_PROPS, WHITE_SHAPES_VAR_PREFIX, whiteShapesComponent } from './component';

export const WHITE_SHAPES_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-white-shapes`;
export const WHITE_SHAPES_CLIP = 'poster';
export const WHITE_SHAPES_KEY_FIELDS = ['title', 'shapes', 'info', 'accent', 'font'];
const WHITE_SHAPES_GRAIN = 0.05;

export const WHITE_SHAPES_POSTER_TEMPLATE: TemplateEntry = {
  id: WHITE_SHAPES_TEMPLATE_ID,
  template: {
    name: 'Poster white shapes',
    description: 'An exhibition poster on black: white skewed blocks stacked like floating volumes, a two-language title and small taupe info blocks set around them, a numbered circle and an index rule.',
    keyFields: WHITE_SHAPES_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-white-shapes', component: WHITE_SHAPES_COMPONENT, code: whiteShapesComponent(), props: WHITE_SHAPES_PROPS, fonts: WHITE_SHAPES_FONTS, varPrefix: WHITE_SHAPES_VAR_PREFIX, vars: [], clip: WHITE_SHAPES_CLIP }, WHITE_SHAPES_GRAIN)
  }
};
