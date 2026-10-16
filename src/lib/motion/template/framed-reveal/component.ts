import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { FR_MODEL } from './model';
import { FR_VIEW } from './view';
import { FR_CSS } from './style';

export const FR_COMPONENT = 'FramedReveal';
export const FR_VAR_PREFIX = 'framed';
export const FR_REVEALS = ['wipe', 'slide', 'scale'];

export const FR_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Manrope', 'DM Sans'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const FR_PROPS: Record<string, PropSpec> = {
  label: text('Caption', 'portraits', { maxLength: 40 }),
  counter: flag('Show the image counter', true, 'Content'),
  media: text('Pictures and videos (in pairs: background, then framed)', '', { format: PropFormat.Media, maxLength: 2000 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  labelSize: number('Caption size (% of the short side)', 2.4, 1, 6, 'Style', 0.1),
  weight: number('Caption weight', 500, 400, 700, 'Style', 100),
  tracking: number('Caption tracking (em)', -0.04, -0.08, 0.04, 'Style', 0.005),
  background: colour('Background', '#0a0a0a'),
  labelColor: colour('Caption colour', '#f2f2f2'),
  backEmpty: colour('Empty background colour', '#2b2b2b'),
  frontEmpty: colour('Empty frame colour', '#e7a35b'),
  mono: flag('Black and white background', true, 'Style'),
  count: number('Image pairs', 3, 2, 6, 'Layout', 1),
  frameWidth: number('Frame width (share of the width)', 0.68, 0.35, 0.9, 'Layout', 0.01),
  frameRatio: number('Frame height to width', 1.25, 0.6, 1.8, 'Layout', 0.05),
  reveal: { type: 'string', title: 'Reveal', enum: FR_REVEALS, default: 'wipe', group: 'Motion' },
  change: number('Reveal length (seconds)', 1.4, 0.6, 2.4, 'Motion', 0.1),
  parallax: number('Parallax', 0.6, 0, 1, 'Motion', 0.05),
  push: number('Push-in', 0.08, 0, 0.2, 'Motion', 0.01),
  [VAR_PREFIX]: text('Runtime variable prefix', FR_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function frComponent(): CustomComponent {
  return {
    source: { html: '', css: FR_CSS.trim(), js: `${FR_MODEL.trim()}\n\n${FR_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: FR_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
