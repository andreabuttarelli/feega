import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { SCROLL_COMPONENT, SCROLL_FONTS, SCROLL_PROPS, SCROLL_VAR_PREFIX, scrollComponent } from './component';

export const SCROLL_TEMPLATE_ID = `${BUILTIN_PREFIX}feature-scroll`;
export const SCROLL_CLIP = 'scroll';
export const SCROLL_VARS = ['openTitle', 'closeTitle', 'lines', 'repeat', 'textColor', 'background', 'align', 'readSpeed', 'readSeconds', 'accelSeconds', 'motionBlur'];

export const FEATURE_SCROLL_TEMPLATE: TemplateEntry = {
  id: SCROLL_TEMPLATE_ID,
  template: {
    name: 'Feature scroll',
    description: 'A title enters, then a list of features scrolls past, readable first, then faster until it blurs, and brakes into a closing title. Every part is a field or a runtime variable.',
    keyFields: ['open_title', 'lines', 'close_title', 'background', 'text_color'],
    doc: customTemplateDoc({ name: 'feature-scroll', component: SCROLL_COMPONENT, code: scrollComponent(), props: SCROLL_PROPS, fonts: SCROLL_FONTS, varPrefix: SCROLL_VAR_PREFIX, vars: SCROLL_VARS, clip: SCROLL_CLIP, seconds: 12, fps: 30 })
  }
};
