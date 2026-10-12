import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { RGB_COMPONENT, RGB_FONTS, RGB_PROPS, RGB_VAR_PREFIX, rgbComponent } from './component';

export const RGB_TEMPLATE_ID = `${BUILTIN_PREFIX}rgb-split-title`;
export const RGB_CLIP = 'rgbsplit';
export const RGB_VARS = ['title', 'background', 'textColor', 'split', 'settle'];

const IN_GROUP: Record<string, readonly string[]> = {
  Text: ['title'],
  Motion: ['split', 'blur', 'settle', 'titleAt']
};

const RGB_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const RGB_SPLIT_TITLE_TEMPLATE: TemplateEntry = {
  id: RGB_TEMPLATE_ID,
  template: {
    name: 'RGB split title',
    description: 'A full-bleed picture arrives torn into red, green and blue and blurred, then settles into focus under a large serif title.',
    keyFields: ['title', 'media', 'background', 'split', 'settle'],
    doc: customTemplateDoc({ name: 'rgb-split-title', component: RGB_COMPONENT, code: rgbComponent(), props: RGB_PROPS, fonts: RGB_FONTS, varPrefix: RGB_VAR_PREFIX, vars: RGB_VARS, clip: RGB_CLIP, seconds: 8, fps: 30, groups: RGB_GROUPS })
  }
};
