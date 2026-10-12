import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { EDITORIAL_COMPONENT, EDITORIAL_FONTS, EDITORIAL_PROPS, EDITORIAL_VAR_PREFIX, editorialComponent } from './component';

export const EDITORIAL_TEMPLATE_ID = `${BUILTIN_PREFIX}editorial-words-media`;
export const EDITORIAL_CLIP = 'editorial';
export const EDITORIAL_VARS = ['phrases', 'background', 'textColor', 'beat', 'quote'];

const IN_GROUP: Record<string, readonly string[]> = {
  Text: ['phrases', 'lowercase', 'quote'],
  Motion: ['beat', 'lead']
};

const EDITORIAL_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const EDITORIAL_WORDS_MEDIA_TEMPLATE: TemplateEntry = {
  id: EDITORIAL_TEMPLATE_ID,
  template: {
    name: 'Editorial words and media',
    description: 'Very large words land on a loose grid, phrase by phrase, while pictures and clips open in the empty cells between them.',
    keyFields: ['phrases', 'media', 'background', 'text_color', 'beat'],
    doc: customTemplateDoc({ name: 'editorial-words-media', component: EDITORIAL_COMPONENT, code: editorialComponent(), props: EDITORIAL_PROPS, fonts: EDITORIAL_FONTS, varPrefix: EDITORIAL_VAR_PREFIX, vars: EDITORIAL_VARS, clip: EDITORIAL_CLIP, seconds: 15, fps: 30, groups: EDITORIAL_GROUPS })
  }
};
