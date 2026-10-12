import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { COLLAGE_COMPONENT, COLLAGE_FONTS, COLLAGE_PROPS, COLLAGE_VAR_PREFIX, collageComponent } from './component';

export const COLLAGE_TEMPLATE_ID = `${BUILTIN_PREFIX}collage-stack-rotate`;
export const COLLAGE_CLIP = 'collage';
export const COLLAGE_VARS = ['word', 'background', 'letterColor', 'count', 'gap'];
export const COLLAGE_KEY_FIELDS = ['media', 'word', 'labels', 'background'];

const IN_GROUP: Record<string, readonly string[]> = {
  Cards: ['count', 'cardScale', 'paper', 'placeholderColor']
};

const COLLAGE_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const COLLAGE_STACK_TEMPLATE: TemplateEntry = {
  id: COLLAGE_TEMPLATE_ID,
  template: {
    name: 'Collage stack',
    description: 'Pictures and white prints pile up one by one, each at its own angle, over huge background letters and a grid of small archive labels.',
    keyFields: COLLAGE_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'collage-stack-rotate', component: COLLAGE_COMPONENT, code: collageComponent(), props: COLLAGE_PROPS, fonts: COLLAGE_FONTS, varPrefix: COLLAGE_VAR_PREFIX, vars: COLLAGE_VARS, clip: COLLAGE_CLIP, seconds: 10, fps: 30, groups: COLLAGE_GROUPS })
  }
};
