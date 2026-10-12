import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { BLUR_LINES_COMPONENT, BLUR_LINES_FONTS, BLUR_LINES_PROPS, BLUR_LINES_VAR_PREFIX, blurLinesComponent } from './component';

export const BLUR_LINES_TEMPLATE_ID = `${BUILTIN_PREFIX}blur-gradient-lines`;
export const BLUR_LINES_CLIP = 'blurlines';
export const BLUR_LINES_VARS = ['text', 'textColor', 'topColor', 'bottomColor', 'glowColor', 'typeAt'];
export const BLUR_LINES_KEY_FIELDS = ['text', 'media', 'top_color', 'bottom_color'];

const IN_GROUP: Record<string, readonly string[]> = {
  Shape: ['shapeColor', 'blur', 'shapeSize', 'shapeX', 'drift'],
  Lines: ['lineColor', 'lineOpacity']
};

const BLUR_LINES_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const BLUR_GRADIENT_LINES_TEMPLATE: TemplateEntry = {
  id: BLUR_LINES_TEMPLATE_ID,
  template: {
    name: 'Blur gradient lines',
    description: 'A soft gradient crossed by thin hairlines, a heavily blurred picture drifting behind, and one line of text typed letter by letter with a glow on the newest letters.',
    keyFields: BLUR_LINES_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'blur-gradient-lines', component: BLUR_LINES_COMPONENT, code: blurLinesComponent(), props: BLUR_LINES_PROPS, fonts: BLUR_LINES_FONTS, varPrefix: BLUR_LINES_VAR_PREFIX, vars: BLUR_LINES_VARS, clip: BLUR_LINES_CLIP, seconds: 10, fps: 30, groups: BLUR_LINES_GROUPS })
  }
};
