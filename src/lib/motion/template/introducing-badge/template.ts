import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { BADGE_COMPONENT, BADGE_FONTS, BADGE_PROPS, BADGE_VAR_PREFIX, badgeComponent } from './component';

export const BADGE_TEMPLATE_ID = `${BUILTIN_PREFIX}introducing-badge`;
export const BADGE_CLIP = 'badge';
export const BADGE_VARS = ['intro', 'brand', 'product', 'accent', 'background', 'textColor'];
export const BADGE_KEY_FIELDS = ['intro', 'brand', 'product', 'logo', 'accent'];

export const INTRODUCING_BADGE_TEMPLATE: TemplateEntry = {
  id: BADGE_TEMPLATE_ID,
  template: {
    name: 'Introducing badge',
    description: 'A launch line on a dark field: a lead word, a glass logo badge and the product name in the accent colour, over a soft planet rising from the bottom.',
    keyFields: BADGE_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'introducing-badge', component: BADGE_COMPONENT, code: badgeComponent(), props: BADGE_PROPS, fonts: BADGE_FONTS, varPrefix: BADGE_VAR_PREFIX, vars: BADGE_VARS, clip: BADGE_CLIP, seconds: 8, fps: 30 })
  }
};
