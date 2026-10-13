import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { RIBBON_COMPONENT, RIBBON_FONTS, RIBBON_PROPS, RIBBON_VAR_PREFIX, ribbonComponent } from './component';

export const RIBBON_TEMPLATE_ID = `${BUILTIN_PREFIX}particle-ribbon`;
export const RIBBON_CLIP = 'ribbon';
export const RIBBON_VARS = ['title', 'background', 'colorA', 'colorB', 'colorC', 'colorD', 'density', 'speed'];
export const RIBBON_KEY_FIELDS = ['title', 'background', 'color_a', 'color_d', 'density'];

const IN_GROUP: Record<string, readonly string[]> = {
  Gradient: ['colorA', 'colorB', 'colorC', 'colorD'],
  Particles: ['density', 'grainSize', 'twist', 'dust']
};

const RIBBON_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const PARTICLE_RIBBON_TEMPLATE: TemplateEntry = {
  id: RIBBON_TEMPLATE_ID,
  template: {
    name: 'Particle ribbon',
    description: 'A fluid sheet of fine grain twists and unfolds on a warm background, coloured along a four-stop gradient and dissolving into dust at its tips. Loops seamlessly; an optional title takes its own beat.',
    keyFields: RIBBON_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'particle-ribbon', component: RIBBON_COMPONENT, code: ribbonComponent(), props: RIBBON_PROPS, fonts: RIBBON_FONTS, varPrefix: RIBBON_VAR_PREFIX, vars: RIBBON_VARS, clip: RIBBON_CLIP, seconds: 10, fps: 30, groups: RIBBON_GROUPS })
  }
};
