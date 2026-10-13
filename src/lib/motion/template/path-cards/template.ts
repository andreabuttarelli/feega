import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { PATH_COMPONENT, PATH_FONTS, PATH_PROPS, PATH_VAR_PREFIX, pathComponent } from './component';

export const PATH_TEMPLATE_ID = `${BUILTIN_PREFIX}path-cards`;
export const PATH_CLIP = 'path';
export const PATH_VARS = ['places', 'reviews', 'accent', 'background', 'moveSeconds', 'holdSeconds'];
export const PATH_KEY_FIELDS = ['places', 'media', 'reviews', 'accent', 'background'];

const IN_GROUP: Record<string, readonly string[]> = {
  Cards: ['addresses', 'ratings', 'reviewers', 'cardColor', 'starColor', 'cardSize'],
  Path: ['accent', 'pathWidth', 'blur']
};

const PATH_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const PATH_CARDS_TEMPLATE: TemplateEntry = {
  id: PATH_TEMPLATE_ID,
  template: {
    name: 'Path cards',
    description: 'A curved path draws itself across a light frame; place and review cards pop up as its dot passes, with the camera following. Every part is a field or a runtime variable.',
    keyFields: PATH_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'path-cards', component: PATH_COMPONENT, code: pathComponent(), props: PATH_PROPS, fonts: PATH_FONTS, varPrefix: PATH_VAR_PREFIX, vars: PATH_VARS, clip: PATH_CLIP, seconds: 12, fps: 30, groups: PATH_GROUPS })
  }
};
