import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { SCROLL_MODEL } from './model';
import { SCROLL_VIEW } from './view';
import { SCROLL_CSS } from './style';

export const SCROLL_COMPONENT = 'FeatureScroll';
export const SCROLL_VAR_PREFIX = 'scroll';

export enum ScrollAlign {
  Center = 'center',
  Left = 'left'
}

export enum ScrollMarker {
  None = 'none',
  Dot = 'dot',
  Rule = 'rule'
}

export const SCROLL_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const FEATURES = [
  'one canvas for every idea',
  'videos made from a prompt',
  'your brand on every frame',
  'templates you can remix',
  'real app screens, not mockups',
  'export to every format',
  'music that fits the cut'
].join('\n');

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const choice = (title: string, options: readonly string[], value: string, group: PropSpec['group']): PropSpec => ({ type: 'string', title, enum: [...options], default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const SCROLL_PROPS: Record<string, PropSpec> = {
  openTitle: text('Opening title', 'everything you need', { maxLength: 80 }),
  closeTitle: text('Closing title', 'in one place.', { maxLength: 80 }),
  lines: text('Features (one per line)', FEATURES, { format: PropFormat.Textarea, maxLength: 2000 }),
  repeat: number('Times the list repeats (more: faster peak)', 4, 1, 12, 'Content', 1),
  lowercase: flag('Lowercase text', true, 'Content'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  fontSize: number('Text size (% of the short side)', 9, 4, 24, 'Style', 0.5),
  fontWeight: number('Text weight', 600, 300, 800, 'Style', 100),
  tracking: number('Text tracking (em)', -0.05, -0.08, 0.05, 'Style', 0.005),
  background: colour('Background', '#000000'),
  textColor: colour('Text colour', '#ffffff'),
  markerColor: colour('Bullet and rule colour', '#5a5a5a'),
  align: choice('Line alignment', Object.values(ScrollAlign), ScrollAlign.Center, 'Layout'),
  marker: choice('Bullets or rules', Object.values(ScrollMarker), ScrollMarker.None, 'Layout'),
  lineSpacing: number('Line spacing', 1.25, 0.8, 3, 'Layout', 0.05),
  gap: number('Gap between title and list (share of the short side)', 0.4, 0.05, 1, 'Layout', 0.01),
  edgeFade: number('Fade at the top and bottom edges', 0.16, 0, 0.45, 'Layout', 0.01),
  titleAt: number('Title starts (seconds)', 0, 0, 4, 'Motion', 0.1),
  holdSeconds: number('Hold on the opening title (seconds)', 0.8, 0, 4, 'Motion', 0.1),
  readSpeed: number('Starting speed (lines per second)', 2.6, 0.3, 8, 'Motion', 0.05),
  readSeconds: number('Readable phase (seconds)', 1.8, 0, 10, 'Motion', 0.1),
  accelSeconds: number('Acceleration (seconds)', 2.4, 0.4, 6, 'Motion', 0.1),
  accelCurve: number('Acceleration curve (higher: later, steeper)', 2.5, 1, 6, 'Motion', 0.1),
  brakeSeconds: number('Braking into the closing title (seconds)', 1.6, 0.4, 4, 'Motion', 0.1),
  motionBlur: number('Motion blur', 0.6, 0, 1.5, 'Motion', 0.05),
  leave: flag('Loop: the closing title leaves at the end', true, 'Motion'),
  [VAR_PREFIX]: text('Runtime variable prefix', SCROLL_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function scrollComponent(): CustomComponent {
  return {
    source: { html: '', css: SCROLL_CSS.trim(), js: `${SCROLL_MODEL.trim()}\n\n${SCROLL_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: SCROLL_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
