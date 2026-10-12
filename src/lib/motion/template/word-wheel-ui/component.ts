import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { WHEEL_MODEL } from './model';
import { WHEEL_VIEW } from './view';
import { WHEEL_CSS } from './style';

export const WHEEL_COMPONENT = 'WordWheelUi';
export const WHEEL_VAR_PREFIX = 'wheel';

export const WHEEL_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Sans'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const WHEEL_PROPS: Record<string, PropSpec> = {
  lead: text('Fixed word', 'New', { maxLength: 30 }),
  words: text('Words on the wheel (comma separated)', 'Features, Interface, Upgrade', { maxLength: 160 }),
  brand: text('Product name on the panel', 'Norvia', { maxLength: 30 }),
  user: text('Name in the greeting', 'Mara', { maxLength: 30 }),
  kicker: text('Panel kicker', 'Everything you need in one place', { maxLength: 60 }),
  headline: text('Panel headline', 'The all-in-one toolkit\nfor modern websites', { format: PropFormat.Textarea, maxLength: 80 }),
  menu: text('Panel menu (comma separated)', 'Theme builder, Widgets, Modules, Template kits, Submission', { maxLength: 140 }),
  media: text('Panel picture or video (empty: a sample dashboard)', '', { format: PropFormat.Media, maxLength: 2000 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  accent: colour('Accent (centred word, glow)', '#62e3b2'),
  background: colour('Background', '#020403'),
  textColor: colour('Fixed word colour', '#ffffff'),
  dimColor: colour('Other words colour', '#4b4f4d'),
  glow: number('Glow strength', 0.75, 0, 1, 'Style', 0.01),
  textSize: number('Words size (% of the short side)', 8, 3, 16, 'Layout', 0.5),
  gap: number('Gap between fixed word and wheel (em)', 0.4, 0, 1.5, 'Layout', 0.01),
  panelSize: number('Panel width (share of frame width)', 0.62, 0.3, 0.9, 'Layout', 0.01),
  yaw: number('Panel turn (degrees)', -22, -40, 10, 'Camera', 1),
  pitch: number('Panel tilt back (degrees)', 6, -10, 25, 'Camera', 1),
  roll: number('Panel roll (degrees)', -3, -10, 10, 'Camera', 0.5),
  drift: number('Camera drift', 1, 0, 2, 'Camera', 0.05),
  enterAt: number('Starts at (seconds)', 0, 0, 4, 'Motion', 0.1),
  enterSeconds: number('Panel entrance (seconds)', 1.8, 0.6, 4, 'Motion', 0.1),
  stepSeconds: number('Wheel turn (seconds)', 0.9, 0.4, 2, 'Motion', 0.05),
  leave: flag('Loop: everything leaves at the end', true, 'Motion'),
  exitSeconds: number('Exit length (seconds)', 1.4, 0.6, 3, 'Motion', 0.1),
  [VAR_PREFIX]: text('Runtime variable prefix', WHEEL_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function wheelComponent(): CustomComponent {
  return {
    source: { html: '', css: WHEEL_CSS.trim(), js: `${WHEEL_MODEL.trim()}\n\n${WHEEL_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: WHEEL_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
