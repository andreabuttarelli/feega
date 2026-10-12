import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { STACK_COMPONENT, STACK_FONTS, STACK_PROPS, STACK_VAR_PREFIX, stackComponent } from './component';

export const STACK_TEMPLATE_ID = `${BUILTIN_PREFIX}stack-words`;
export const STACK_CLIP = 'stack';
export const STACK_VARS = ['words', 'background', 'textColor', 'beat', 'cards'];

const IN_GROUP: Record<string, readonly string[]> = {
  Text: ['words'],
  Media: ['cards'],
  Motion: ['beat', 'lead']
};

const STACK_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const STACK_WORDS_TEMPLATE: TemplateEntry = {
  id: STACK_TEMPLATE_ID,
  template: {
    name: 'Stack words',
    description: 'Portrait cards are dealt in from the left one after another, overlapping on a light table, and two words land above and below the last one.',
    keyFields: ['words', 'media', 'background', 'text_color', 'beat'],
    doc: customTemplateDoc({ name: 'stack-words', component: STACK_COMPONENT, code: stackComponent(), props: STACK_PROPS, fonts: STACK_FONTS, varPrefix: STACK_VAR_PREFIX, vars: STACK_VARS, clip: STACK_CLIP, seconds: 10, fps: 30, groups: STACK_GROUPS })
  }
};
