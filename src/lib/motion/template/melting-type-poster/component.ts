import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { MELT_MODEL } from './model';
import { MELT_VIEW } from './view';
import { MELT_CSS } from './style';

export const MELT_COMPONENT = 'MeltingTypePoster';
export const MELT_VAR_PREFIX = 'melt';

export const MELT_FONTS = ['Inter', 'Inter Tight', 'Geist', 'Instrument Sans', 'Manrope', 'DM Sans', 'Space Grotesk'];

const BODY_LEFT =
  'Sand is what is left when a mountain stops arguing with the weather. Every grain was once part of something larger and remembers none of it.';

const BODY_MID =
  'Ink is no different. A sentence holds together only as long as nobody looks away. Turn the page slowly enough and the letters loosen, one serif at a time.';

const BODY_RIGHT =
  'Nothing is lost in the fall. The grains keep their count, wait at the bottom of the page, and rise again in the same order the moment someone reads them.';

const text = (title: string, value: string, maxLength = 120): PropSpec => ({ type: 'string', title, default: value, group: 'Content', maxLength });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const MELT_PROPS: Record<string, PropSpec> = {
  title: text('Title', 'Nothing\nkeeps its\nshape', 60),
  subtitle: text('Lede', 'A page is only a pause. Give it time and every letter goes the way of the dune, then returns when the wind turns.', 200),
  index: text('Number', '12', 6),
  kicker: text('Masthead', 'Field notes on erosion', 60),
  bodyLeft: text('Body, left column', BODY_LEFT, 600),
  bodyMid: text('Body, middle column', BODY_MID, 600),
  bodyRight: text('Body, right column', BODY_RIGHT, 600),
  footer: text('Footer', 'Printed on borrowed time. Please return every grain.', 120),
  credit: text('Credit', 'Slow Matter Quarterly', 60),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  page: colour('Page', '#100f0d'),
  surround: colour('Around the page', '#76726b'),
  ink: colour('Ink', '#efe6d6'),
  strength: number('Share of the page that turns to sand', 1, 0, 1, 'Motion', 0.05),
  meltAt: number('Sand starts (seconds)', 0.6, 0, 4, 'Motion', 0.1),
  spread: number('Top-to-bottom sweep (seconds)', 4.2, 0.2, 6, 'Motion', 0.1),
  gravity: number('Gravity (page heights per s²)', 1.6, 0.4, 6, 'Motion', 0.1),
  wind: number('Wind drift', 0.08, -0.4, 0.4, 'Motion', 0.01),
  [VAR_PREFIX]: text('Runtime variable prefix', MELT_VAR_PREFIX, 20)
};

export function meltComponent(): CustomComponent {
  return {
    source: { html: '', css: MELT_CSS.trim(), js: `${MELT_MODEL.trim()}\n\n${MELT_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: MELT_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
