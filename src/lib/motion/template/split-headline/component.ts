import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { SPLIT_MODEL } from './model';
import { SPLIT_VIEW } from './view';
import { SPLIT_CSS } from './style';

export const SPLIT_COMPONENT = 'SplitHeadline';
export const SPLIT_VAR_PREFIX = 'split';

export enum SplitGrow {
  Width = 'width',
  Size = 'size'
}

export enum SplitStack {
  Auto = 'auto',
  Row = 'row',
  Column = 'column'
}

export const SPLIT_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const choice = (title: string, options: readonly string[], value: string, group: PropSpec['group']): PropSpec => ({ type: 'string', title, enum: [...options], default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const SPLIT_PROPS: Record<string, PropSpec> = {
  headline: text('Headline', 'your story in motion', { maxLength: 80 }),
  splitAt: number('Words before the image (0: middle)', 0, 0, 12, 'Content', 1),
  media: text('Image or video (id or link; video:id)', '', { maxLength: 2000 }),
  lowercase: flag('Lowercase headline', true, 'Content'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  fontSize: number('Headline size (% of the short side)', 13.5, 4, 30, 'Style', 0.5),
  fontWeight: number('Headline weight', 600, 300, 800, 'Style', 100),
  tracking: number('Headline tracking (em)', -0.05, -0.08, 0.05, 'Style', 0.005),
  background: colour('Background', '#000000'),
  textColor: colour('Headline colour', '#ffffff'),
  placeholderColor: colour('Empty image colour', '#1a1a1a'),
  radius: number('Image corner radius (% of its height, 50 is a pill)', 7, 0, 50, 'Style', 1),
  imageHeight: number('Image height (em of the headline)', 1.7, 0.3, 4, 'Layout', 0.05),
  aspect: number('Image aspect (width / height)', 1.8, 0.3, 4, 'Layout', 0.05),
  gap: number('Gap between image and words (em)', 0.22, 0, 1, 'Layout', 0.01),
  grow: choice('Grow from', Object.values(SplitGrow), SplitGrow.Width, 'Layout'),
  stack: choice('Halves side by side or stacked', Object.values(SplitStack), SplitStack.Auto, 'Layout'),
  titleAt: number('Headline starts (seconds)', 0.2, 0, 4, 'Motion', 0.1),
  openDelay: number('Extra wait before the image opens (seconds)', 0, 0, 4, 'Motion', 0.1),
  openSeconds: number('Opening duration (seconds)', 1.4, 0.3, 4, 'Motion', 0.1),
  innerZoom: flag('Zoom the picture as it opens', true, 'Motion'),
  zoomAmount: number('Inner zoom amount', 0.25, 0, 1, 'Motion', 0.01),
  holdSeconds: number('Hold open (seconds)', 2.5, 0, 10, 'Motion', 0.1),
  closeSeconds: number('Closing duration (seconds)', 1, 0.3, 4, 'Motion', 0.1),
  leave: flag('Loop: the image closes and the headline leaves', true, 'Motion'),
  [VAR_PREFIX]: text('Runtime variable prefix', SPLIT_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function splitComponent(): CustomComponent {
  return {
    source: { html: '', css: SPLIT_CSS.trim(), js: `${SPLIT_MODEL.trim()}\n\n${SPLIT_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: SPLIT_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
