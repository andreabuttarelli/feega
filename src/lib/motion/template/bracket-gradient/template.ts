import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { BRACKET_COMPONENT, BRACKET_FONTS, BRACKET_PROPS, BRACKET_VAR_PREFIX, bracketComponent } from './component';

export const BRACKET_TEMPLATE_ID = `${BUILTIN_PREFIX}bracket-gradient`;
export const BRACKET_CLIP = 'bracket';
export const BRACKET_VARS = ['headline', 'textColor', 'markColor', 'background', 'violet', 'red', 'orange', 'openSeconds', 'leave'];

export const BRACKET_GRADIENT_TEMPLATE: TemplateEntry = {
  id: BRACKET_TEMPLATE_ID,
  template: {
    name: 'Bracket gradient',
    keyFields: ['headline', 'text_color', 'mark_color', 'violet', 'orange'],
    description: 'A thin sentence on a slowly moving soft gradient, framed by four small corner marks that open from the centre as it appears.',
    doc: customTemplateDoc({ name: 'bracket-gradient', component: BRACKET_COMPONENT, code: bracketComponent(), props: BRACKET_PROPS, fonts: BRACKET_FONTS, varPrefix: BRACKET_VAR_PREFIX, vars: BRACKET_VARS, clip: BRACKET_CLIP, seconds: 8, fps: 30 })
  }
};
