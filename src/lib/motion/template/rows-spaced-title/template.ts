import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { ROWS_COMPONENT, ROWS_FONTS, ROWS_PROPS, ROWS_VAR_PREFIX, rowsComponent } from './component';

export const ROWS_TEMPLATE_ID = `${BUILTIN_PREFIX}rows-spaced-title`;
export const ROWS_CLIP = 'rows';
export const ROWS_VARS = ['title', 'background', 'titleColor', 'speed', 'direction', 'spacing', 'tighten'];

const IN_GROUP: Record<string, readonly string[]> = {
  Photos: ['media', 'count'],
  Motion: ['speed', 'direction', 'delay', 'stagger', 'tighten']
};

const ROWS_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const ROWS_SPACED_TITLE_TEMPLATE: TemplateEntry = {
  id: ROWS_TEMPLATE_ID,
  template: {
    name: 'Rows and spaced title',
    description: 'Two rows of square photos glide in opposite directions above and below a title whose words land one by one, set far apart.',
    keyFields: ['title', 'media', 'background', 'title_color', 'speed'],
    doc: customTemplateDoc({ name: 'rows-spaced-title', component: ROWS_COMPONENT, code: rowsComponent(), props: ROWS_PROPS, fonts: ROWS_FONTS, varPrefix: ROWS_VAR_PREFIX, vars: ROWS_VARS, clip: ROWS_CLIP, seconds: 12, fps: 30, groups: ROWS_GROUPS })
  }
};
