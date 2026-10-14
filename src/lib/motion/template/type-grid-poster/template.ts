import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { TYPE_GRID_COMPONENT, TYPE_GRID_FONTS, TYPE_GRID_PROPS, TYPE_GRID_VAR_PREFIX, typeGridComponent } from './component';

export const TYPE_GRID_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-type-grid`;
export const TYPE_GRID_CLIP = 'poster';
export const TYPE_GRID_KEY_FIELDS = ['lines', 'media', 'paper', 'ink', 'font'];
const TYPE_GRID_GRAIN = 0.12;

export const TYPE_GRID_POSTER_TEMPLATE: TemplateEntry = {
  id: TYPE_GRID_TEMPLATE_ID,
  template: {
    name: 'Poster type grid',
    description: 'An event poster: a stack of huge all-caps lines on acid yellow, grainy photo crops set inline between the words, an arrow, and four columns of details at the foot.',
    keyFields: TYPE_GRID_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-type-grid', component: TYPE_GRID_COMPONENT, code: typeGridComponent(), props: TYPE_GRID_PROPS, fonts: TYPE_GRID_FONTS, varPrefix: TYPE_GRID_VAR_PREFIX, vars: [], clip: TYPE_GRID_CLIP }, TYPE_GRID_GRAIN)
  }
};
