import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { GRID_COMPONENT, GRID_FONTS, GRID_PROPS, GRID_VAR_PREFIX, gridComponent } from './component';

export const GRID_TEMPLATE_ID = `${BUILTIN_PREFIX}grid-words-media`;
export const GRID_CLIP = 'gridwords';
export const GRID_VARS = ['phrases', 'background', 'textColor', 'beat', 'seed'];

const IN_GROUP: Record<string, readonly string[]> = {
  Text: ['phrases', 'lowercase'],
  Motion: ['beat', 'lead', 'seed']
};

const GRID_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const GRID_WORDS_MEDIA_TEMPLATE: TemplateEntry = {
  id: GRID_TEMPLATE_ID,
  template: {
    name: 'Grid words and media',
    description: 'A sentence appears word by word on white chips snapped to a paper grid, with small pictures landing in the cells between them.',
    keyFields: ['phrases', 'media', 'background', 'seed', 'beat'],
    doc: customTemplateDoc({ name: 'grid-words-media', component: GRID_COMPONENT, code: gridComponent(), props: GRID_PROPS, fonts: GRID_FONTS, varPrefix: GRID_VAR_PREFIX, vars: GRID_VARS, clip: GRID_CLIP, seconds: 12, fps: 30, groups: GRID_GROUPS })
  }
};
