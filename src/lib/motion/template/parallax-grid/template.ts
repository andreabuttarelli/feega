import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { PGRID_COMPONENT, PGRID_FONTS, PGRID_PROPS, PGRID_VAR_PREFIX, pgridComponent } from './component';

export const PGRID_TEMPLATE_ID = `${BUILTIN_PREFIX}parallax-grid`;
export const PGRID_CLIP = 'grid';
export const PGRID_VARS = ['motion', 'columns', 'gap', 'speed', 'spread', 'scroll', 'segments', 'background', 'showTitle', 'title'];
export const PGRID_KEY_FIELDS = ['media', 'motion', 'columns', 'background'];

const IN_GROUP: Record<string, readonly string[]> = {
  Grid: ['columns', 'gap', 'tileAspect', 'placeholderColor'],
  Motion: ['motion', 'speed', 'spread', 'scroll', 'segments', 'titleAt']
};

const PGRID_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const PARALLAX_GRID_TEMPLATE: TemplateEntry = {
  id: PGRID_TEMPLATE_ID,
  template: {
    name: 'Parallax grid',
    description: 'Columns of pictures and videos scroll past at different speeds, as on a smoothly scrolled page. Pick a motion: parallax, alternate, stagger, zoom or drift.',
    keyFields: PGRID_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'parallax-grid', component: PGRID_COMPONENT, code: pgridComponent(), props: PGRID_PROPS, fonts: PGRID_FONTS, varPrefix: PGRID_VAR_PREFIX, vars: PGRID_VARS, clip: PGRID_CLIP, seconds: 10, fps: 30, groups: PGRID_GROUPS })
  }
};
