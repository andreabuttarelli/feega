import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { BRACKET_MODEL } from './model';
import { BRACKET_VIEW } from './view';
import { BRACKET_CSS } from './style';

export const BRACKET_COMPONENT = 'BracketGradient';
export const BRACKET_VAR_PREFIX = 'bracket';

export const BRACKET_FONTS = ['Inter', 'Inter Tight', 'Geist', 'Instrument Sans', 'Manrope', 'DM Sans', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const BRACKET_PROPS: Record<string, PropSpec> = {
  headline: text('Sentence', 'The AI powered platform for modern creatives', { maxLength: 120 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  fontSize: number('Text size (% of the short side)', 4.8, 2, 12, 'Style', 0.1),
  fontWeight: number('Text weight', 300, 200, 700, 'Style', 100),
  tracking: number('Tracking (em)', -0.01, -0.06, 0.06, 'Style', 0.005),
  textColor: colour('Text colour', '#ffffff'),
  markColor: colour('Bracket colour', '#0a0a0a'),
  background: colour('Background', '#ebebeb'),
  violet: colour('Gradient: violet', '#dc8ae6'),
  red: colour('Gradient: red', '#e65652'),
  orange: colour('Gradient: orange', '#e8963a'),
  ember: colour('Gradient: deep red', '#e0533f'),
  haze: colour('Gradient: haze', '#e2c4ea'),
  markSize: number('Bracket size (em)', 0.22, 0.05, 0.6, 'Layout', 0.01),
  padX: number('Bracket side gap (em)', 0.5, 0, 3, 'Layout', 0.05),
  padY: number('Bracket top/bottom gap (em)', 0.3, 0, 3, 'Layout', 0.05),
  maxWidth: number('Text width (% of the frame)', 80, 30, 95, 'Layout', 1),
  drift: number('Gradient drift', 0.07, 0, 0.4, 'Motion', 0.01),
  titleAt: number('Brackets start (seconds)', 0.3, 0, 4, 'Motion', 0.1),
  openSeconds: number('Bracket opening (seconds)', 1.4, 0.3, 4, 'Motion', 0.1),
  closeSeconds: number('Bracket closing (seconds)', 1, 0.3, 4, 'Motion', 0.1),
  leave: { type: 'boolean', title: 'Loop: the text leaves and the brackets close', default: true, group: 'Motion' },
  [VAR_PREFIX]: text('Runtime variable prefix', BRACKET_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function bracketComponent(): CustomComponent {
  return {
    source: { html: '', css: BRACKET_CSS.trim(), js: `${BRACKET_MODEL.trim()}\n\n${BRACKET_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: BRACKET_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
