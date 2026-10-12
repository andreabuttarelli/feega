import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { RING_MODEL } from './model';
import { RING_VIEW } from './view';
import { RING_CSS } from './style';

export const RING_COMPONENT = 'RingThroughTitle';
export const RING_VAR_PREFIX = 'ring';

export const RING_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const RING_PROPS: Record<string, PropSpec> = {
  title: text('Title', '11 winners', { maxLength: 60 }),
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  lowercase: flag('Lowercase title', true, 'Content'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  titleWidth: number('Title width (share of the frame)', 0.68, 0.3, 0.95, 'Style', 0.01),
  fontWeight: number('Title weight', 400, 300, 800, 'Style', 100),
  tracking: number('Title tracking (em)', -0.06, -0.1, 0.05, 'Style', 0.005),
  background: colour('Background', '#000000'),
  titleColor: colour('Title colour', '#ffffff'),
  placeholderColor: colour('Empty card colour', '#1c1c1c'),
  cards: number('Cards', 16, 6, 32, 'Layout', 1),
  cardSize: number('Card size (share of the short side)', 0.115, 0.06, 0.3, 'Layout', 0.01),
  cardAspect: number('Card aspect (width / height)', 1.45, 0.6, 2, 'Layout', 0.05),
  variety: number('Size variety', 0.35, 0, 0.8, 'Layout', 0.05),
  radius: number('Ring radius (share of the short side)', 0.37, 0.2, 0.6, 'Layout', 0.01),
  yaw: number('Ring turn (degrees, left side forward)', 38, 0, 70, 'Camera', 1),
  tilt: number('Ring tilt (degrees)', 6, -30, 30, 'Camera', 1),
  backDim: number('Dim the far cards', 0.2, 0, 1, 'Camera', 0.05),
  turns: number('Rotation (turns per loop)', 1, 0, 4, 'Motion', 1),
  titleAt: number('Title starts (seconds)', 0.2, 0, 6, 'Motion', 0.1),
  ringAt: number('Ring starts (seconds)', 0.9, 0, 6, 'Motion', 0.1),
  ringSeconds: number('Card entrance (seconds)', 1.6, 0.4, 3, 'Motion', 0.1),
  stagger: number('Card stagger, first to last (seconds)', 1.1, 0, 3, 'Motion', 0.1),
  leave: flag('Loop: everything leaves at the end', true, 'Motion'),
  [VAR_PREFIX]: text('Runtime variable prefix', RING_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function ringComponent(): CustomComponent {
  return {
    source: { html: '', css: RING_CSS.trim(), js: `${RING_MODEL.trim()}\n\n${RING_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: RING_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
