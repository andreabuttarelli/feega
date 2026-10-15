import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { SS_MODEL } from './model';
import { SS_VIEW } from './view';
import { SS_CSS } from './style';

export const SS_COMPONENT = 'ShowcaseScatter';
export const SS_VAR_PREFIX = 'showcase';

export const SS_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Manrope', 'DM Sans', 'Instrument Sans'];

const META = ['Showcase', 'No. 14', 'Studio edition', 'Formats (5)', 'YR26'].join('\n');
const TYPE_CARD = ['Mono', 'Mid-Black', '1.69'].join('\n');

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const SS_PROPS: Record<string, PropSpec> = {
  headline: text('Headline', 'Showcase vol. 14', { maxLength: 40 }),
  meta: text('Corner text (3 top, then bottom left, bottom right)', META, { format: PropFormat.Textarea, maxLength: 200 }),
  typeCard: text('Type card (three lines)', TYPE_CARD, { format: PropFormat.Textarea, maxLength: 80 }),
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  headlineSize: number('Headline size (% of the short side)', 10, 4, 18, 'Style', 0.5),
  metaSize: number('Corner text size (% of the short side)', 1.7, 1, 4, 'Style', 0.1),
  weight: number('Headline weight', 500, 400, 700, 'Style', 100),
  tracking: number('Headline tracking (em)', -0.05, -0.08, 0.02, 'Style', 0.005),
  background: colour('Background', '#e4e4e6'),
  ink: colour('Text colour', '#111111'),
  blockColor: colour('Colour block', '#f2c94c'),
  dotsColor: colour('Dotted block', '#57bd6c'),
  typeCardColor: colour('Type card', '#ffffff'),
  placeholderColor: colour('Empty card colour', '#cbcbcf'),
  count: number('Cards', 10, 6, 12, 'Layout', 1),
  cardSize: number('Card size', 1, 0.6, 1.4, 'Layout', 0.05),
  depth: number('Depth', 0.6, 0, 1, 'Layout', 0.05),
  drift: number('Drift', 1, 0, 2, 'Motion', 0.05),
  laps: number('Orbits per loop', 1, 1, 3, 'Motion', 1),
  [VAR_PREFIX]: text('Runtime variable prefix', SS_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function ssComponent(): CustomComponent {
  return {
    source: { html: '', css: SS_CSS.trim(), js: `${SS_MODEL.trim()}\n\n${SS_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: SS_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
