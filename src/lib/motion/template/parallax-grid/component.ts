import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { PGRID_MODEL } from './model';
import { PGRID_VIEW } from './view';
import { PGRID_CSS } from './style';

export const PGRID_COMPONENT = 'ParallaxGrid';
export const PGRID_VAR_PREFIX = 'pgrid';

export enum GridMotion {
  Parallax = 'parallax',
  Alternate = 'alternate',
  Stagger = 'stagger',
  Zoom = 'zoom',
  Drift = 'drift'
}

export enum GridScroll {
  Segments = 'segments',
  Continuous = 'continuous'
}

export const PGRID_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });
const choice = (title: string, values: string[], group: PropSpec['group']): PropSpec => ({ type: 'string', title, enum: values, default: values[0], group });

export const PGRID_PROPS: Record<string, PropSpec> = {
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  motion: choice('Motion', Object.values(GridMotion), 'Motion'),
  columns: number('Columns', 4, 3, 6, 'Layout', 1),
  gap: number('Gap (share of the width)', 0.012, 0, 0.05, 'Layout', 0.002),
  tileAspect: number('Image aspect (width / height)', 0.75, 0.4, 2, 'Layout', 0.05),
  background: colour('Background', '#000000'),
  placeholderColor: colour('Empty tile colour', '#161616'),
  speed: number('Speed (column loops per video)', 1, 1, 4, 'Motion', 1),
  spread: number('Speed difference between columns', 0.6, 0, 1, 'Motion', 0.05),
  scroll: choice('Scroll', Object.values(GridScroll), 'Motion'),
  segments: number('Scroll moves per loop', 3, 1, 8, 'Motion', 1),
  showTitle: flag('Show a title over the grid', false, 'Content'),
  title: text('Title', 'scroll through it', { maxLength: 80 }),
  lowercase: flag('Lowercase title', true, 'Content'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  fontSize: number('Title size (% of the short side)', 13, 4, 24, 'Style', 0.5),
  fontWeight: number('Title weight', 600, 300, 800, 'Style', 100),
  tracking: number('Title tracking (em)', -0.05, -0.08, 0.05, 'Style', 0.005),
  titleColor: colour('Title colour', '#ffffff'),
  titleAt: number('Title starts (seconds)', 1, 0, 8, 'Motion', 0.1),
  [VAR_PREFIX]: text('Runtime variable prefix', PGRID_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function pgridComponent(): CustomComponent {
  return {
    source: { html: '', css: PGRID_CSS.trim(), js: `${PGRID_MODEL.trim()}\n\n${PGRID_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: PGRID_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
