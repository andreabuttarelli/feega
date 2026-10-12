import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { MELT_COMPONENT, MELT_FONTS, MELT_PROPS, MELT_VAR_PREFIX, meltComponent } from './component';

export const MELT_TEMPLATE_ID = `${BUILTIN_PREFIX}melting-type-poster`;
export const MELT_CLIP = 'melt';
export const MELT_VARS = ['title', 'subtitle', 'ink', 'page', 'strength'];
export const MELT_KEY_FIELDS = ['title', 'subtitle', 'body_left', 'strength'];

const IN_GROUP: Record<string, readonly string[]> = {
  Body: ['bodyLeft', 'bodyMid', 'bodyRight', 'footer', 'credit']
};

const MELT_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const MELTING_TYPE_POSTER_TEMPLATE: TemplateEntry = {
  id: MELT_TEMPLATE_ID,
  template: {
    name: 'Melting type poster',
    description: 'A dark editorial page that crumbles, top to bottom, into fine sand piling at the foot of the page, then rises back into type, on a loop.',
    keyFields: MELT_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'melting-type-poster', component: MELT_COMPONENT, code: meltComponent(), props: MELT_PROPS, fonts: MELT_FONTS, varPrefix: MELT_VAR_PREFIX, vars: MELT_VARS, clip: MELT_CLIP, seconds: 10, fps: 30, groups: MELT_GROUPS })
  }
};
