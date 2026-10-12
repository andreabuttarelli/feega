import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { POSTER_GLASS_COMPONENT, POSTER_GLASS_FONTS, POSTER_GLASS_PROPS, POSTER_GLASS_VAR_PREFIX, posterGlassComponent } from './component';

export const POSTER_GLASS_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-liquid-glass`;
export const POSTER_GLASS_CLIP = 'poster';
export const POSTER_GLASS_VARS = ['leftColumn', 'rightColumn', 'ink', 'muted', 'paper', 'wall'];
export const POSTER_GLASS_KEY_FIELDS = ['left_column', 'right_column', 'ink', 'paper', 'wall'];

const IN_GROUP: Record<string, readonly string[]> = {
  Glass: ['glassSize', 'refraction', 'shine']
};

const POSTER_GLASS_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const POSTER_LIQUID_GLASS_TEMPLATE: TemplateEntry = {
  id: POSTER_GLASS_TEMPLATE_ID,
  template: {
    name: 'Poster liquid glass',
    description: 'A Swiss typographic poster on a grey wall, two columns of big grotesk words and dates, with a clear liquid-glass stream flowing over it and bending the type underneath.',
    keyFields: POSTER_GLASS_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'poster-liquid-glass', component: POSTER_GLASS_COMPONENT, code: posterGlassComponent(), props: POSTER_GLASS_PROPS, fonts: POSTER_GLASS_FONTS, varPrefix: POSTER_GLASS_VAR_PREFIX, vars: POSTER_GLASS_VARS, clip: POSTER_GLASS_CLIP, seconds: 10, fps: 30, groups: POSTER_GLASS_GROUPS })
  }
};
