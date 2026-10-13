import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { FLOW_COMPONENT, FLOW_FONTS, FLOW_PROPS, FLOW_VAR_PREFIX, flowComponent } from './component';

export const FLOW_TEMPLATE_ID = `${BUILTIN_PREFIX}flow-lines`;
export const FLOW_CLIP = 'flow';
export const FLOW_VARS = ['title', 'lineColor', 'background', 'titleColor', 'density', 'turbulence', 'speed', 'size'];
export const FLOW_KEY_FIELDS = ['title', 'line_color', 'background', 'density', 'turbulence'];

const IN_GROUP: Record<string, readonly string[]> = {
  Lines: ['lineColor', 'background', 'density', 'turbulence', 'size'],
  Motion: ['speed', 'titleAt', 'titleSeconds', 'titleDim']
};

const FLOW_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const FLOW_LINES_TEMPLATE: TemplateEntry = {
  id: FLOW_TEMPLATE_ID,
  template: {
    name: 'Flow lines',
    description: 'Thousands of fine strands grow, follow a slowly swirling current and fade on black, with a title in its own beat. Generative, loops seamlessly.',
    keyFields: FLOW_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'flow-lines', component: FLOW_COMPONENT, code: flowComponent(), props: FLOW_PROPS, fonts: FLOW_FONTS, varPrefix: FLOW_VAR_PREFIX, vars: FLOW_VARS, clip: FLOW_CLIP, seconds: 10, fps: 60, groups: FLOW_GROUPS })
  }
};
