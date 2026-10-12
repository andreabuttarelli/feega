import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { GTW_COMPONENT, GTW_FONTS, GTW_PROPS, GTW_VAR_PREFIX, gtwComponent } from './component';

export const GTW_TEMPLATE_ID = `${BUILTIN_PREFIX}glass-tiles-wall`;
export const GTW_CLIP = 'wall';
export const GTW_VARS = ['titles', 'background', 'textColor', 'tileSize', 'curve', 'moves', 'tilt', 'glass'];
export const GTW_KEY_FIELDS = ['media', 'titles', 'captions', 'background', 'curve'];

const IN_GROUP: Record<string, readonly string[]> = {
  Wall: ['tileSize', 'tileAspect', 'gap', 'roundness', 'glass', 'curve', 'placeholderColor'],
  Camera: ['moves', 'step', 'tilt', 'lift']
};

const GTW_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const GLASS_TILES_WALL_TEMPLATE: TemplateEntry = {
  id: GTW_TEMPLATE_ID,
  template: {
    name: 'Glass tiles wall',
    description: 'A curved wall of glossy glass tiles, each a picture or video with a title and caption, while the camera pans slowly across it. Loops.',
    keyFields: GTW_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'glass-tiles-wall', component: GTW_COMPONENT, code: gtwComponent(), props: GTW_PROPS, fonts: GTW_FONTS, varPrefix: GTW_VAR_PREFIX, vars: GTW_VARS, clip: GTW_CLIP, seconds: 12, fps: 30, groups: GTW_GROUPS })
  }
};
