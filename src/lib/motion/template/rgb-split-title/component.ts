import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { RGB_MODEL } from './model';
import { RGB_VIEW } from './view';
import { RGB_CSS } from './style';

export const RGB_COMPONENT = 'RgbSplitTitle';
export const RGB_VAR_PREFIX = 'rgbsplit';

export const RGB_FONTS = ['Newsreader', 'Literata', 'Source Serif 4', 'EB Garamond', 'Instrument Serif', 'Fraunces', 'Inter'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const RGB_PROPS: Record<string, PropSpec> = {
  title: text('Title', 'The most precise edit model', { maxLength: 120 }),
  media: text('Picture or video', '', { format: PropFormat.Media, maxLength: 2000 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Newsreader', group: 'Style' },
  fontSize: number('Title size (share of the width)', 0.068, 0.03, 0.12, 'Style', 0.002),
  fontWeight: number('Title weight', 400, 300, 700, 'Style', 100),
  tracking: number('Tracking (em)', -0.01, -0.06, 0.05, 'Style', 0.005),
  background: colour('Background', '#dfe2e5'),
  textColor: colour('Title colour', '#fbfaf7'),
  placeholderColor: colour('Empty picture colour', '#7d6f78'),
  mediaHeight: number('Picture height (share of the frame)', 1.15, 0.6, 1.6, 'Layout', 0.05),
  mediaWidth: number('Picture width (share of its height)', 1.25, 0.6, 2, 'Layout', 0.05),
  mediaX: number('Picture centre (share of the width)', 0.56, 0.3, 0.7, 'Layout', 0.01),
  split: number('Colour split (share of the width)', 0.03, 0, 0.1, 'Motion', 0.005),
  blur: number('Blur (share of the short side)', 0.006, 0, 0.06, 'Motion', 0.001),
  settle: number('Time to focus (seconds)', 4, 1, 6, 'Motion', 0.1),
  titleAt: number('Title starts at (seconds)', 0.7, 0, 3, 'Motion', 0.05),
  [VAR_PREFIX]: text('Runtime variable prefix', RGB_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function rgbComponent(): CustomComponent {
  return {
    source: { html: '', css: RGB_CSS.trim(), js: `${RGB_MODEL.trim()}\n\n${RGB_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: RGB_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
