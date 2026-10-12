import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { POSTER_GLASS_MODEL } from './model';
import { POSTER_GLASS_VIEW } from './view';
import { POSTER_GLASS_CSS } from './style';

export const POSTER_GLASS_COMPONENT = 'PosterLiquidGlass';
export const POSTER_GLASS_VAR_PREFIX = 'poster';

export const POSTER_GLASS_FONTS = ['Inter', 'Inter Tight', 'Geist', 'Instrument Sans', 'Manrope', 'DM Sans', 'Space Grotesk'];

const LEFT_COLUMN = ['Lectures', '~24.–', '~26.', '~Sep', '~Us', '~BY', '~NiGht', '~Ostend', '18.', 'Oct', 'FoRm', 'DaYs', 'Verona'].join('\n');
const RIGHT_COLUMN = ['~1. Dec', '~Nicer', '~TuesdaYs', '~Leeds', '12.', 'Nov', 'Swiss', 'Modern', 'Archive', 'Lucerne', '~7. Oct', '~VKS', '~Bern'].join('\n');

const lines = (title: string, value: string): PropSpec => ({ type: 'string', title, default: value, format: PropFormat.Textarea, maxLength: 400, group: 'Content' });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const POSTER_GLASS_PROPS: Record<string, PropSpec> = {
  leftColumn: lines('Left column (one line each, ~ for grey)', LEFT_COLUMN),
  rightColumn: lines('Right column (one line each, ~ for grey)', RIGHT_COLUMN),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  fontWeight: number('Type weight', 500, 300, 800, 'Style', 100),
  tracking: number('Type tracking (em)', -0.045, -0.1, 0.05, 'Style', 0.005),
  ink: colour('Type colour', '#0b0b0b'),
  muted: colour('Grey type colour', '#a7a7a7'),
  paper: colour('Poster colour', '#f3f3f2'),
  wall: colour('Wall colour', '#c6c6c8'),
  clips: flag('Binder clips on the poster', true, 'Style'),
  glassSize: number('Glass size', 1, 0.6, 1.4, 'Layout', 0.05),
  refraction: number('Refraction', 1, 0, 2, 'Layout', 0.05),
  shine: number('Highlights', 1, 0, 2, 'Layout', 0.05),
  flow: number('Flow cycles per loop', 1, 1, 3, 'Motion', 1),
  wander: number('How far the glass wanders', 1, 0, 1.6, 'Motion', 0.05),
  [VAR_PREFIX]: { type: 'string', title: 'Runtime variable prefix', default: POSTER_GLASS_VAR_PREFIX, maxLength: 20, group: 'Layout' }
};

export function posterGlassComponent(): CustomComponent {
  return {
    source: { html: '', css: POSTER_GLASS_CSS.trim(), js: `${POSTER_GLASS_MODEL.trim()}\n\n${POSTER_GLASS_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: POSTER_GLASS_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
