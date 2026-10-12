import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { GridMotion, PGRID_COMPONENT, PGRID_FONTS, PGRID_PROPS, PGRID_VAR_PREFIX, pgridComponent } from './component';

export const PGRID_TEMPLATE_ID = `${BUILTIN_PREFIX}parallax-grid`;
export const PGRID_CLIP = 'grid';
export const PGRID_VARS = ['motion', 'columns', 'gap', 'speed', 'spread', 'scroll', 'segments', 'background', 'showTitle', 'title'];
export const PGRID_KEY_FIELDS = ['media', 'motion', 'columns', 'background'];

const IN_GROUP: Record<string, readonly string[]> = {
  Grid: ['columns', 'gap', 'tileAspect', 'placeholderColor'],
  Motion: ['motion', 'speed', 'spread', 'scroll', 'segments', 'titleAt']
};

const PGRID_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

const VARIANTS: { motion: GridMotion; name: string; description: string }[] = [
  { motion: GridMotion.Parallax, name: 'Parallax columns', description: 'Columns of pictures and videos scroll the same way at different speeds, as on a smoothly scrolled page.' },
  { motion: GridMotion.Alternate, name: 'Alternating columns', description: 'Columns of pictures and videos scroll in opposite directions, one up, the next down.' },
  { motion: GridMotion.Stagger, name: 'Staggered columns', description: 'Columns of pictures and videos start scrolling one after another, in a wave.' },
  { motion: GridMotion.Zoom, name: 'Depth columns', description: 'Columns of pictures and videos at different depths: wider ones scroll faster, under a slow push-in.' },
  { motion: GridMotion.Drift, name: 'Drifting columns', description: 'Columns of pictures and videos drift slowly and steadily, without stopping.' }
];

const variantId = (motion: GridMotion) => (motion === GridMotion.Parallax ? PGRID_TEMPLATE_ID : `${PGRID_TEMPLATE_ID}-${motion}`);

const variant = (v: (typeof VARIANTS)[number]): TemplateEntry => {
  const props = { ...PGRID_PROPS, motion: { ...PGRID_PROPS.motion, default: v.motion } };
  return {
    id: variantId(v.motion),
    template: {
      name: v.name,
      description: `${v.description} Every part is a field or a runtime variable.`,
      keyFields: PGRID_KEY_FIELDS,
      doc: customTemplateDoc({ name: `parallax-grid-${v.motion}`, component: PGRID_COMPONENT, code: pgridComponent(), props, fonts: PGRID_FONTS, varPrefix: PGRID_VAR_PREFIX, vars: PGRID_VARS, clip: PGRID_CLIP, seconds: 10, fps: 30, groups: PGRID_GROUPS })
    }
  };
};

export const PGRID_TEMPLATES: TemplateEntry[] = VARIANTS.map(variant);
export const PARALLAX_GRID_TEMPLATE = PGRID_TEMPLATES[0];
