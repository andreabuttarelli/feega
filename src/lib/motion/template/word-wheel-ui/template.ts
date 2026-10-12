import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { WHEEL_COMPONENT, WHEEL_FONTS, WHEEL_PROPS, WHEEL_VAR_PREFIX, wheelComponent } from './component';

export const WHEEL_TEMPLATE_ID = `${BUILTIN_PREFIX}word-wheel-ui`;
export const WHEEL_CLIP = 'wheel';
export const WHEEL_VARS = ['lead', 'words', 'brand', 'headline', 'accent', 'background', 'glow', 'yaw', 'drift', 'stepSeconds', 'leave'];
export const WHEEL_KEY_FIELDS = ['lead', 'words', 'brand', 'accent', 'media'];

const IN_GROUP: Record<string, readonly string[]> = {
  Panel: ['brand', 'user', 'kicker', 'headline', 'menu'],
  Camera: ['panelSize', 'yaw', 'pitch', 'roll', 'drift']
};

const WHEEL_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const WORD_WHEEL_UI_TEMPLATE: TemplateEntry = {
  id: WHEEL_TEMPLATE_ID,
  template: {
    name: 'Word wheel UI',
    keyFields: WHEEL_KEY_FIELDS,
    description: 'A fixed word and a slot-machine wheel of words turn on a dark glow, the centred word lit in the accent, while a tilted dashboard panel glides in from the right in perspective. Every part is a field or a runtime variable.',
    doc: customTemplateDoc({ name: 'word-wheel-ui', component: WHEEL_COMPONENT, code: wheelComponent(), props: WHEEL_PROPS, fonts: WHEEL_FONTS, varPrefix: WHEEL_VAR_PREFIX, vars: WHEEL_VARS, clip: WHEEL_CLIP, seconds: 12, fps: 30, groups: WHEEL_GROUPS })
  }
};
