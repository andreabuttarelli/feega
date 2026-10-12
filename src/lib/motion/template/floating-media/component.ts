import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { FLOAT_MODEL } from './model';
import { FLOAT_VIEW } from './view';
import { FLOAT_CSS } from './style';

export const FLOAT_COMPONENT = 'FloatingMedia';
export const FLOAT_VAR_PREFIX = 'float';

export enum FloatLayout {
  Orbit = 'orbit',
  Cloud = 'cloud',
  GridDepth = 'grid-depth'
}

export const FLOAT_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const FLOAT_PROPS: Record<string, PropSpec> = {
  title: text('Title', 'made to move', { maxLength: 80 }),
  subtitle: text('Subtitle', '', { maxLength: 120 }),
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  lowercase: flag('Lowercase title', true, 'Content'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  fontSize: number('Title size (% of the short side)', 13, 4, 24, 'Style', 0.5),
  fontWeight: number('Title weight', 600, 300, 800, 'Style', 100),
  tracking: number('Title tracking (em)', -0.05, -0.08, 0.05, 'Style', 0.005),
  background: colour('Background', '#000000'),
  titleColor: colour('Title colour', '#ffffff'),
  subtitleColor: colour('Subtitle colour', '#9a9a9a'),
  placeholderColor: colour('Empty card colour', '#1a1a1a'),
  radius: number('Card radius (%, 50 is a circle)', 0, 0, 50, 'Style', 1),
  border: number('Card border (px at 1080)', 0, 0, 12, 'Style', 1),
  borderColor: colour('Card border colour', '#ffffff'),
  shadow: number('Card shadow', 1, 0, 2, 'Style', 0.1),
  count: number('Cards', 5, 1, 12, 'Layout', 1),
  layout: { type: 'string', title: 'Layout', enum: Object.values(FloatLayout), default: FloatLayout.Orbit, group: 'Layout' },
  cardSize: number('Card size (share of the short side)', 0.36, 0.1, 0.5, 'Layout', 0.01),
  safeWidth: number('Clear zone width (share of width)', 0.5, 0.1, 0.9, 'Layout', 0.01),
  safeHeight: number('Clear zone height (share of short side)', 0.34, 0.1, 0.8, 'Layout', 0.01),
  depth: number('Depth', 2, 0, 4, 'Layout', 0.1),
  contain: flag('Keep cards inside the frame', true, 'Layout'),
  tilt: number('Card tilt', 0.4, 0, 2, 'Layout', 0.1),
  focusBlur: number('Depth of field blur', 1.5, 0, 6, 'Camera', 0.1),
  dim: number('Dim far cards', 0.45, 0, 1, 'Camera', 0.05),
  push: number('Camera push-in', 0.18, 0, 0.6, 'Camera', 0.01),
  drift: number('Drift amount', 0.02, 0, 0.12, 'Motion', 0.005),
  speed: number('Drift speed', 0.6, 0.2, 4, 'Motion', 0.1),
  resistance: number('Resistance', 0.8, 0.1, 3, 'Motion', 0.05),
  entrance: flag('Cards fly in', true, 'Motion'),
  enterAt: number('Cards start after the title (seconds)', 0, 0, 4, 'Motion', 0.1),
  stagger: number('Card stagger (seconds)', 0.25, 0, 0.6, 'Motion', 0.01),
  titleAt: number('Title starts (seconds)', 0, 0, 4, 'Motion', 0.1),
  titleBlur: number('Title blur-in (em)', 0, 0, 1, 'Motion', 0.05),
  leave: flag('Loop: everything leaves at the end', true, 'Motion'),
  [VAR_PREFIX]: text('Runtime variable prefix', FLOAT_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function floatComponent(): CustomComponent {
  return {
    source: { html: '', css: FLOAT_CSS.trim(), js: `${FLOAT_MODEL.trim()}\n\n${FLOAT_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: FLOAT_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
