import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { FLOAT_COMPONENT, FLOAT_FONTS, FLOAT_PROPS, FLOAT_VAR_PREFIX, floatComponent } from './component';

export const FLOAT_TEMPLATE_ID = `${BUILTIN_PREFIX}floating-media`;
export const FLOAT_CLIP = 'float';
export const FLOAT_VARS = ['title', 'subtitle', 'titleColor', 'background', 'layout', 'count', 'depth', 'drift', 'speed', 'resistance', 'push'];

export const FLOATING_MEDIA_TEMPLATE: TemplateEntry = {
  id: FLOAT_TEMPLATE_ID,
  template: {
    name: 'Floating media',
    description: 'A big title enters while pictures and videos float around it in 3D depth, drifting slowly as if through water.',
    keyFields: ['title', 'subtitle', 'media', 'background', 'title_color'],
    doc: customTemplateDoc({ name: 'floating-media', component: FLOAT_COMPONENT, code: floatComponent(), props: FLOAT_PROPS, fonts: FLOAT_FONTS, varPrefix: FLOAT_VAR_PREFIX, vars: FLOAT_VARS, clip: FLOAT_CLIP, seconds: 10, fps: 30 })
  }
};
