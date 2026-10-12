import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { CLOUD_COMPONENT, CLOUD_FONTS, CLOUD_PROPS, CLOUD_VAR_PREFIX, cloudComponent } from './component';

export const CLOUD_TEMPLATE_ID = `${BUILTIN_PREFIX}media-cloud-white`;
export const CLOUD_CLIP = 'cloud';
export const CLOUD_VARS = ['title', 'titleColor', 'background', 'count', 'tileSize', 'passes', 'drift', 'titleAt'];
export const CLOUD_KEY_FIELDS = ['title', 'media', 'background', 'title_color', 'count'];

const IN_GROUP: Record<string, readonly string[]> = {
  Cloud: ['count', 'tileSize', 'spread', 'centreBoost', 'placeholderColor'],
  Camera: ['passes', 'drift', 'blur']
};

const CLOUD_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const MEDIA_CLOUD_TEMPLATE: TemplateEntry = {
  id: CLOUD_TEMPLATE_ID,
  template: {
    name: 'Media cloud',
    description: 'The camera flies slowly through a dense cloud of small pictures and videos on white; a title can fade in at the end. Loops.',
    keyFields: CLOUD_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'media-cloud-white', component: CLOUD_COMPONENT, code: cloudComponent(), props: CLOUD_PROPS, fonts: CLOUD_FONTS, varPrefix: CLOUD_VAR_PREFIX, vars: CLOUD_VARS, clip: CLOUD_CLIP, seconds: 12, fps: 30, groups: CLOUD_GROUPS })
  }
};
