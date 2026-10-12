import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { TVS_MODEL } from './model';
import { TVS_VIEW } from './view';
import { TVS_CSS } from './style';

export const TVS_COMPONENT = 'VintageTvs';
export const TVS_VAR_PREFIX = 'tvs';

export const TVS_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const TVS_PROPS: Record<string, PropSpec> = {
  title: text('Title', 'tune in', { maxLength: 60 }),
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  lowercase: flag('Lowercase title', true, 'Content'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  fontSize: number('Title size (% of the short side)', 14, 4, 26, 'Style', 0.5),
  fontWeight: number('Title weight', 600, 400, 700, 'Style', 100),
  tracking: number('Title tracking (em)', -0.04, -0.08, 0.04, 'Style', 0.005),
  background: colour('Room', '#0e0b09'),
  titleColor: colour('Title colour', '#f3efe7'),
  glowColor: colour('Screen light', '#d9e6ff'),
  placeholderColor: colour('Empty screen colour', '#2a3036'),
  count: number('Televisions', 7, 4, 7, 'Layout', 1),
  wallSize: number('Pile size (share of the frame)', 0.84, 0.5, 0.95, 'Layout', 0.01),
  curvature: number('Glass curvature', 0.5, 0, 1, 'Style', 0.05),
  scanlines: number('Scanlines', 0.5, 0, 1, 'Style', 0.05),
  fringe: number('Colour fringe', 0.5, 0, 1, 'Style', 0.05),
  flicker: number('Flicker', 0.5, 0, 1, 'Style', 0.05),
  onAt: number('First set turns on (seconds)', 0.1, 0, 3, 'Motion', 0.1),
  onStagger: number('Gap between sets turning on (seconds)', 0.28, 0, 1, 'Motion', 0.02),
  onSeconds: number('Turn-on length (seconds)', 0.9, 0.3, 2, 'Motion', 0.1),
  firstSwitch: number('First channel switch (seconds)', 4.2, 1, 12, 'Motion', 0.1),
  channelSeconds: number('Seconds per channel', 2.4, 0.8, 8, 'Motion', 0.1),
  pushAt: number('Push into the title set (seconds)', 6.2, 1, 20, 'Motion', 0.1),
  pushSeconds: number('Push length (seconds)', 1.4, 0.6, 3, 'Motion', 0.1),
  leave: flag('Loop: sets turn off and the camera pulls back', true, 'Motion'),
  [VAR_PREFIX]: text('Runtime variable prefix', TVS_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function tvsComponent(): CustomComponent {
  return {
    source: { html: '', css: TVS_CSS.trim(), js: `${TVS_MODEL.trim()}\n\n${TVS_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: TVS_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
