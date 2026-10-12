import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { RING_COMPONENT, RING_FONTS, RING_PROPS, RING_VAR_PREFIX, ringComponent } from './component';

export const RING_TEMPLATE_ID = `${BUILTIN_PREFIX}ring-through-title`;
export const RING_CLIP = 'ring';
export const RING_VARS = ['title', 'titleColor', 'background', 'cards', 'turns', 'yaw', 'tilt', 'titleAt'];
export const RING_KEY_FIELDS = ['title', 'media', 'background', 'turns'];

const IN_GROUP: Record<string, readonly string[]> = {
  Ring: ['cards', 'cardSize', 'cardAspect', 'variety', 'radius', 'placeholderColor'],
  Camera: ['yaw', 'tilt', 'backDim']
};

const RING_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const RING_THROUGH_TITLE_TEMPLATE: TemplateEntry = {
  id: RING_TEMPLATE_ID,
  template: {
    name: 'Ring through title',
    description: 'A huge title, then a tilted ring of pictures and videos turns around it, passing in front of the letters on one side and behind them on the other. Every part is a field or a runtime variable.',
    keyFields: RING_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'ring-through-title', component: RING_COMPONENT, code: ringComponent(), props: RING_PROPS, fonts: RING_FONTS, varPrefix: RING_VAR_PREFIX, vars: RING_VARS, clip: RING_CLIP, seconds: 12, fps: 30, groups: RING_GROUPS })
  }
};
