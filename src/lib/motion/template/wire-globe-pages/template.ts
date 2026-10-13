import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { WIRE_COMPONENT, WIRE_PROPS, WIRE_VAR_PREFIX, wireComponent } from './component';

export const WIRE_TEMPLATE_ID = `${BUILTIN_PREFIX}wire-globe-pages`;
export const WIRE_CLIP = 'wire-globe';
export const WIRE_VARS = ['background', 'lineColor', 'monochrome', 'pages', 'turns', 'axisTilt'];
export const WIRE_KEY_FIELDS = ['media', 'monochrome', 'background', 'turns'];

const IN_GROUP: Record<string, readonly string[]> = {
  Globe: ['lineColor', 'lineOpacity', 'backLines', 'gridStep', 'pages', 'pageSize', 'pageAspect', 'radius', 'emptyColor'],
  Camera: ['backDim', 'axisTilt', 'sway']
};

const WIRE_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const WIRE_GLOBE_PAGES_TEMPLATE: TemplateEntry = {
  id: WIRE_TEMPLATE_ID,
  template: {
    name: 'Wire globe pages',
    description: 'Pages and pictures bent onto a slowly turning wireframe globe, the back side seen dimmed through the wire. Loops.',
    keyFields: WIRE_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'wire-globe-pages', component: WIRE_COMPONENT, code: wireComponent(), props: WIRE_PROPS, fonts: [], varPrefix: WIRE_VAR_PREFIX, vars: WIRE_VARS, clip: WIRE_CLIP, seconds: 12, fps: 30, groups: WIRE_GROUPS })
  }
};
