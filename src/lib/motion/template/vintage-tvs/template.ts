import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { TVS_COMPONENT, TVS_FONTS, TVS_PROPS, TVS_VAR_PREFIX, tvsComponent } from './component';

export const TVS_TEMPLATE_ID = `${BUILTIN_PREFIX}vintage-tvs`;
export const TVS_CLIP = 'tvs';
export const TVS_VARS = ['title', 'titleColor', 'background', 'glowColor', 'count', 'curvature', 'scanlines', 'pushAt'];
export const TVS_KEY_FIELDS = ['title', 'media', 'count', 'background'];

const IN_GROUP: Record<string, readonly string[]> = {
  TVs: ['count', 'wallSize', 'placeholderColor'],
  Screen: ['glowColor', 'curvature', 'scanlines', 'fringe', 'flicker']
};

const TVS_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const VINTAGE_TVS_TEMPLATE: TemplateEntry = {
  id: TVS_TEMPLATE_ID,
  template: {
    name: 'Vintage TVs',
    description: 'A pile of old televisions in a dim room switches on one by one, each screen playing your pictures and videos with a cathode-ray look; the camera pushes into one set for the title. Loops.',
    keyFields: TVS_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'vintage-tvs', component: TVS_COMPONENT, code: tvsComponent(), props: TVS_PROPS, fonts: TVS_FONTS, varPrefix: TVS_VAR_PREFIX, vars: TVS_VARS, clip: TVS_CLIP, seconds: 13, fps: 30, groups: TVS_GROUPS })
  }
};
