import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { SplitStack } from '../split-headline/component';
import { PHONE_MODEL } from './model';
import { PHONE_VIEW } from './view';
import { PHONE_CSS } from './style';

export const PHONE_COMPONENT = 'PhoneSplit';
export const PHONE_VAR_PREFIX = 'phone';

export enum PhoneFinish {
  Natural = 'natural',
  Black = 'black',
  White = 'white',
  Desert = 'desert'
}

export const PHONE_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const choice = (title: string, options: readonly string[], value: string, group: PropSpec['group']): PropSpec => ({ type: 'string', title, enum: [...options], default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const PHONE_PROPS: Record<string, PropSpec> = {
  headline: text('Headline', 'made to be held', { maxLength: 80 }),
  splitAt: number('Words left of the phone (0: middle)', 0, 0, 12, 'Content', 1),
  media: text('Screen image or video (empty: a sample app screen)', '', { format: PropFormat.Media, maxLength: 2000 }),
  lowercase: flag('Lowercase headline', true, 'Content'),
  finish: choice('Device colour', Object.values(PhoneFinish), PhoneFinish.Natural, 'Style'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  fontSize: number('Headline size (% of the short side)', 11, 4, 30, 'Style', 0.5),
  fontWeight: number('Headline weight', 600, 300, 800, 'Style', 100),
  tracking: number('Headline tracking (em)', -0.05, -0.08, 0.05, 'Style', 0.005),
  background: colour('Background', '#f4f3f0'),
  textColor: colour('Headline colour', '#0a0a0a'),
  screenAccent: colour('Sample screen accent', '#ff5a1f'),
  shadow: number('Shadow strength', 0.22, 0, 0.6, 'Style', 0.01),
  phoneHeight: number('Phone height (em of the headline)', 6.6, 2, 12, 'Layout', 0.1),
  gap: number('Gap between phone and words (em)', 0.45, 0, 2, 'Layout', 0.01),
  stack: choice('Halves side by side or stacked', Object.values(SplitStack), SplitStack.Auto, 'Layout'),
  riseAt: number('Phone starts rising (seconds)', 0.2, 0, 4, 'Motion', 0.1),
  riseSeconds: number('Rise duration (seconds)', 1.8, 0.4, 4, 'Motion', 0.1),
  titleDelay: number('Extra wait before the headline (seconds)', 0, 0, 4, 'Motion', 0.1),
  tilt: flag('Tilt back while rising', true, 'Motion'),
  tiltDegrees: number('Tilt (degrees)', 16, 0, 40, 'Motion', 1),
  dropSeconds: number('Descent duration (seconds)', 1.3, 0.4, 4, 'Motion', 0.1),
  leave: flag('Loop: words leave and the phone descends', true, 'Motion'),
  [VAR_PREFIX]: text('Runtime variable prefix', PHONE_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function phoneComponent(): CustomComponent {
  return {
    source: { html: '', css: PHONE_CSS.trim(), js: `${PHONE_MODEL.trim()}\n\n${PHONE_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: PHONE_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
