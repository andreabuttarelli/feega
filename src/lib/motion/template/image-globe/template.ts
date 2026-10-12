import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { GLOBE_COMPONENT, GLOBE_FONTS, GLOBE_PROPS, GLOBE_VAR_PREFIX, globeComponent } from './component';

export const GLOBE_TEMPLATE_ID = `${BUILTIN_PREFIX}image-globe`;
export const GLOBE_CLIP = 'globe';
export const GLOBE_VARS = ['title', 'titleColor', 'background', 'tiles', 'turns', 'axisTilt', 'globeDim', 'titleAt'];
export const GLOBE_KEY_FIELDS = ['title', 'media', 'background', 'turns'];

const IN_GROUP: Record<string, readonly string[]> = {
  Globe: ['tiles', 'tileSize', 'tileAspect', 'radius', 'placeholderColor'],
  Camera: ['axisTilt', 'backDim', 'globeDim', 'push']
};

const GLOBE_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const IMAGE_GLOBE_TEMPLATE: TemplateEntry = {
  id: GLOBE_TEMPLATE_ID,
  template: {
    name: 'Image globe',
    description: 'Pictures and videos assemble into a turning 3D globe, then a title enters in front of it. Every part is a field or a runtime variable.',
    keyFields: GLOBE_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'image-globe', component: GLOBE_COMPONENT, code: globeComponent(), props: GLOBE_PROPS, fonts: GLOBE_FONTS, varPrefix: GLOBE_VAR_PREFIX, vars: GLOBE_VARS, clip: GLOBE_CLIP, seconds: 10, fps: 30, groups: GLOBE_GROUPS })
  }
};
