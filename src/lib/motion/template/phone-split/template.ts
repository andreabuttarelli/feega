import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { PHONE_COMPONENT, PHONE_FONTS, PHONE_PROPS, PHONE_VAR_PREFIX, phoneComponent } from './component';

export const PHONE_TEMPLATE_ID = `${BUILTIN_PREFIX}phone-split`;
export const PHONE_CLIP = 'phone';
export const PHONE_VARS = ['headline', 'splitAt', 'finish', 'textColor', 'background', 'gap', 'riseSeconds', 'tilt', 'leave'];

const IN_GROUP: Record<string, readonly string[]> = {
  Device: ['finish', 'phoneHeight', 'shadow', 'tilt', 'tiltDegrees', 'screenAccent']
};

const PHONE_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const PHONE_SPLIT_TEMPLATE: TemplateEntry = {
  id: PHONE_TEMPLATE_ID,
  template: {
    name: 'Phone split',
    keyFields: ['headline', 'media', 'finish', 'background'],
    description: 'A modern smartphone rises from below into the centre, then the headline appears split on either side of it. Every part is a field or a runtime variable.',
    doc: customTemplateDoc({ name: 'phone-split', component: PHONE_COMPONENT, code: phoneComponent(), props: PHONE_PROPS, fonts: PHONE_FONTS, varPrefix: PHONE_VAR_PREFIX, vars: PHONE_VARS, clip: PHONE_CLIP, seconds: 8, fps: 30, groups: PHONE_GROUPS })
  }
};
