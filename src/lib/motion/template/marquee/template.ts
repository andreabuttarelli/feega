import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { MARQUEE_COMPONENT, MARQUEE_FONTS, MARQUEE_PROPS, MARQUEE_VAR_PREFIX, marqueeComponent } from './component';

export const MARQUEE_TEMPLATE_ID = `${BUILTIN_PREFIX}marquee`;
export const MARQUEE_CLIP = 'marquee';
export const MARQUEE_VARS = ['quotes', 'wordmarks', 'content', 'rows', 'direction', 'alternate', 'speed', 'background', 'ink', 'cardColor', 'monochrome', 'fade', 'pauseOnHover', 'drag'];

const IN_GROUP: Record<string, readonly string[]> = {
  Items: ['media', 'quotes', 'wordmarks', 'content'],
  Motion: ['direction', 'speed', 'alternate', 'rows'],
  Interaction: ['drag', 'pauseOnHover', 'glide']
};

const MARQUEE_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const MARQUEE_TEMPLATE: TemplateEntry = {
  id: MARQUEE_TEMPLATE_ID,
  template: {
    name: 'Marquee',
    description: 'Rows of logos, testimonials or images scroll on their own, sideways or up and down; in an embed, grab a row to scrub it and let go to send it gliding back to speed.',
    keyFields: ['media', 'quotes', 'direction', 'speed', 'background'],
    doc: customTemplateDoc({ name: 'marquee', component: MARQUEE_COMPONENT, code: marqueeComponent(), props: MARQUEE_PROPS, fonts: MARQUEE_FONTS, varPrefix: MARQUEE_VAR_PREFIX, vars: MARQUEE_VARS, clip: MARQUEE_CLIP, seconds: 12, fps: 30, groups: MARQUEE_GROUPS })
  }
};
