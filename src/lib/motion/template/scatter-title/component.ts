import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { SCATTER_MODEL } from './model';
import { SCATTER_VIEW } from './view';
import { SCATTER_CSS } from './style';

export const SCATTER_COMPONENT = 'ScatterTitle';
export const SCATTER_VAR_PREFIX = 'scatter';
export const SCATTER_MAX_CARDS = 12;

export const SCATTER_FONTS = ['Inter', 'Inter Tight', 'Geist', 'Instrument Sans', 'Manrope', 'DM Sans', 'Space Grotesk', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const SCATTER_PROPS: Record<string, PropSpec> = {
  title: text('Title', 'up to $100k cash', { maxLength: 80 }),
  lowercase: flag('Lowercase title', true, 'Content'),
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  fontSize: number('Title size (% of the short side)', 11.5, 4, 20, 'Style', 0.5),
  fontWeight: number('Title weight', 400, 300, 800, 'Style', 100),
  tracking: number('Title tracking (em)', -0.03, -0.08, 0.05, 'Style', 0.005),
  background: colour('Background', '#000000'),
  titleColor: colour('Title colour', '#ffffff'),
  placeholderColor: colour('Empty card colour', '#1c1c1c'),
  count: number('Cards', SCATTER_MAX_CARDS, 1, SCATTER_MAX_CARDS, 'Layout', 1),
  cardScale: number('Card size', 1, 0.5, 1.4, 'Layout', 0.05),
  spread: number('Outward drift (share of distance per loop)', 0.14, 0, 0.4, 'Motion', 0.01),
  depth: number('Depth (cards grow as they drift)', 0.6, 0, 1, 'Motion', 0.05),
  cardsAt: number('Cards start (seconds)', 0.1, 0, 4, 'Motion', 0.1),
  stagger: number('Card stagger, centre to edge (seconds)', 0.08, 0, 0.4, 'Motion', 0.01),
  titleAt: number('Title starts (seconds)', 0.3, 0, 4, 'Motion', 0.1),
  leave: flag('Loop: everything leaves at the end', true, 'Motion'),
  [VAR_PREFIX]: text('Runtime variable prefix', SCATTER_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function scatterComponent(): CustomComponent {
  return {
    source: { html: '', css: SCATTER_CSS.trim(), js: `${SCATTER_MODEL.trim()}\n\n${SCATTER_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: SCATTER_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
