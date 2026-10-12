import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { SPLIT_COMPONENT, SPLIT_FONTS, SPLIT_PROPS, SPLIT_VAR_PREFIX, splitComponent } from './component';

export const SPLIT_TEMPLATE_ID = `${BUILTIN_PREFIX}split-headline`;
export const SPLIT_CLIP = 'split';
export const SPLIT_VARS = ['headline', 'splitAt', 'media', 'textColor', 'background', 'mask', 'imageHeight', 'aspect', 'gap', 'openSeconds', 'holdSeconds', 'innerZoom', 'leave'];

export const SPLIT_HEADLINE_TEMPLATE: TemplateEntry = {
  id: SPLIT_TEMPLATE_ID,
  template: {
    name: 'Split headline',
    description: 'A headline enters, then an image grows from nothing between its two halves, pushing the words apart as it opens. Every part is a field or a runtime variable.',
    doc: customTemplateDoc({ name: 'split-headline', component: SPLIT_COMPONENT, code: splitComponent(), props: SPLIT_PROPS, fonts: SPLIT_FONTS, varPrefix: SPLIT_VAR_PREFIX, vars: SPLIT_VARS, clip: SPLIT_CLIP, seconds: 8, fps: 30 })
  }
};
