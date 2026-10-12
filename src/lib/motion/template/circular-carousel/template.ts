import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { CAROUSEL_COMPONENT, CAROUSEL_FONTS, CAROUSEL_PROPS, CAROUSEL_VAR_PREFIX, carouselComponent } from './component';

export const CAROUSEL_TEMPLATE_ID = `${BUILTIN_PREFIX}circular-carousel`;
export const CAROUSEL_CLIP = 'carousel';
export const CAROUSEL_VARS = ['captions', 'background', 'captionColor', 'autoplay', 'interval', 'direction', 'buttons', 'buttonStyle', 'buttonColor', 'drag', 'visible'];
export const CAROUSEL_KEY_FIELDS = ['media', 'captions', 'background', 'autoplay'];

const IN_GROUP: Record<string, readonly string[]> = {
  Media: ['media', 'captions', 'lowercase'],
  Ring: ['itemSize', 'aspect', 'radius', 'shadow', 'gap', 'ringRadius', 'perspective', 'tilt', 'visible', 'dim', 'lift', 'placeholderColor'],
  Interaction: ['autoplay', 'interval', 'moveSeconds', 'direction', 'buttons', 'buttonStyle', 'buttonColor', 'drag']
};

const CAROUSEL_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const CIRCULAR_CAROUSEL_TEMPLATE: TemplateEntry = {
  id: CAROUSEL_TEMPLATE_ID,
  template: {
    name: 'Circular carousel',
    description: 'Pictures and videos on a 3D ring, the front one large and sharp. Live: turn it with the round buttons, a drag or the arrow keys. In a video it turns by itself, one item at a time.',
    keyFields: CAROUSEL_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'circular-carousel', component: CAROUSEL_COMPONENT, code: carouselComponent(), props: CAROUSEL_PROPS, fonts: CAROUSEL_FONTS, varPrefix: CAROUSEL_VAR_PREFIX, vars: CAROUSEL_VARS, clip: CAROUSEL_CLIP, seconds: 12, fps: 30, groups: CAROUSEL_GROUPS })
  }
};
