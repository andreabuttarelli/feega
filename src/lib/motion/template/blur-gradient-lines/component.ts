import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { BLUR_LINES_MODEL } from './model';
import { BLUR_LINES_VIEW } from './view';
import { BLUR_LINES_CSS } from './style';

export const BLUR_LINES_COMPONENT = 'BlurGradientLines';
export const BLUR_LINES_VAR_PREFIX = 'blurlines';

export const BLUR_LINES_FONTS = ['Inter', 'Inter Tight', 'Geist', 'Manrope', 'DM Sans', 'Instrument Sans', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const BLUR_LINES_PROPS: Record<string, PropSpec> = {
  text: text('Text', 'Imagine to have all your tools', { maxLength: 60 }),
  media: text('Picture or video to blur', '', { format: PropFormat.Media, maxLength: 2000 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  fontSize: number('Text size (% of the short side)', 6.6, 3, 14, 'Style', 0.1),
  fontWeight: number('Text weight', 300, 100, 700, 'Style', 100),
  tracking: number('Text tracking (em)', -0.02, -0.08, 0.08, 'Style', 0.005),
  topColor: colour('Gradient top', '#a291ea'),
  bottomColor: colour('Gradient bottom', '#d8a68a'),
  textColor: colour('Text colour', '#ffffff'),
  glowColor: colour('Glow on new letters', '#b98cff'),
  lineColor: colour('Hairline colour', '#ffffff'),
  shapeColor: colour('Shape colour without media', '#f3b48c'),
  lineOpacity: number('Hairline opacity', 0.7, 0, 1, 'Layout', 0.05),
  blur: number('Shape blur (% of the short side)', 6, 0, 10, 'Layout', 0.1),
  shapeSize: number('Shape height (share of the short side)', 0.7, 0.3, 1.2, 'Layout', 0.01),
  shapeX: number('Shape offset (share of the width)', -0.1, -0.4, 0.4, 'Layout', 0.01),
  drift: number('Shape drift (share of the short side)', 0.06, 0, 0.2, 'Motion', 0.01),
  typeAt: number('Typing starts (seconds)', 1, 0, 6, 'Motion', 0.1),
  typeSeconds: number('Typing length (seconds)', 2.6, 0.6, 6, 'Motion', 0.1),
  leave: flag('Loop: everything leaves at the end', true, 'Motion'),
  [VAR_PREFIX]: text('Runtime variable prefix', BLUR_LINES_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function blurLinesComponent(): CustomComponent {
  return {
    source: { html: '', css: BLUR_LINES_CSS.trim(), js: `${BLUR_LINES_MODEL.trim()}\n\n${BLUR_LINES_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: BLUR_LINES_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
