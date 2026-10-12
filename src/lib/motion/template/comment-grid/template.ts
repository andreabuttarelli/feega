import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { COMMENTS_COMPONENT, COMMENTS_FONTS, COMMENTS_PROPS, COMMENTS_VAR_PREFIX, commentsComponent } from './component';

export const COMMENTS_TEMPLATE_ID = `${BUILTIN_PREFIX}comment-grid`;
export const COMMENTS_CLIP = 'comments';
export const COMMENTS_VARS = ['title', 'theme', 'accent', 'background', 'titleColor', 'speed', 'gridDim', 'titleAt'];
export const COMMENTS_KEY_FIELDS = ['title', 'comments', 'theme', 'avatars'];

const IN_GROUP: Record<string, readonly string[]> = {
  Cards: ['cardWidth', 'gap', 'radius', 'shadow', 'cardFont', 'accent', 'cardColor', 'textColor'],
  Camera: ['gridDim', 'gridBlur']
};

const COMMENTS_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const COMMENT_GRID_TEMPLATE: TemplateEntry = {
  id: COMMENTS_TEMPLATE_ID,
  template: {
    name: 'Comment grid',
    description: 'A drifting grid of comment cards enters from the centre out, then a title lands over it. Every part is a field or a runtime variable.',
    keyFields: COMMENTS_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'comment-grid', component: COMMENTS_COMPONENT, code: commentsComponent(), props: COMMENTS_PROPS, fonts: COMMENTS_FONTS, varPrefix: COMMENTS_VAR_PREFIX, vars: COMMENTS_VARS, clip: COMMENTS_CLIP, seconds: 10, fps: 30, groups: COMMENTS_GROUPS })
  }
};
