import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { SCATTER_COMPONENT, SCATTER_FONTS, SCATTER_PROPS, SCATTER_VAR_PREFIX, scatterComponent } from './component';

export const SCATTER_TEMPLATE_ID = `${BUILTIN_PREFIX}scatter-title`;
export const SCATTER_CLIP = 'scatter';
export const SCATTER_VARS = ['title', 'titleColor', 'background', 'count', 'spread', 'depth'];
export const SCATTER_KEY_FIELDS = ['title', 'media', 'background', 'title_color'];

const IN_GROUP: Record<string, readonly string[]> = {
  Cards: ['count', 'cardScale', 'placeholderColor']
};

const SCATTER_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const SCATTER_TITLE_TEMPLATE: TemplateEntry = {
  id: SCATTER_TEMPLATE_ID,
  template: {
    name: 'Scatter title',
    description: 'A centred title over flat pictures and videos scattered around the frame, drifting slowly outward like an editorial ad collage.',
    keyFields: SCATTER_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'scatter-title', component: SCATTER_COMPONENT, code: scatterComponent(), props: SCATTER_PROPS, fonts: SCATTER_FONTS, varPrefix: SCATTER_VAR_PREFIX, vars: SCATTER_VARS, clip: SCATTER_CLIP, seconds: 10, fps: 30, groups: SCATTER_GROUPS })
  }
};
