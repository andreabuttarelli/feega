import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { CLOUD_MODEL } from './model';
import { CLOUD_VIEW } from './view';
import { CLOUD_CSS } from './style';

export const CLOUD_COMPONENT = 'MediaCloud';
export const CLOUD_VAR_PREFIX = 'cloud';

export const CLOUD_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const CLOUD_PROPS: Record<string, PropSpec> = {
  title: text('Title', 'made of moments', { maxLength: 80 }),
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  lowercase: flag('Lowercase title', true, 'Content'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  fontSize: number('Title size (% of the short side)', 11, 4, 24, 'Style', 0.5),
  fontWeight: number('Title weight', 500, 300, 800, 'Style', 100),
  tracking: number('Title tracking (em)', -0.05, -0.08, 0.05, 'Style', 0.005),
  background: colour('Background', '#ffffff'),
  titleColor: colour('Title colour', '#0a0a0a'),
  placeholderColor: colour('Empty tile colour', '#e6e6e6'),
  count: number('Tiles', 150, 20, 200, 'Layout', 1),
  tileSize: number('Tile size (share of the short side, mid-cloud)', 0.07, 0.02, 0.2, 'Layout', 0.005),
  spread: number('Cloud width', 1, 0.5, 2, 'Layout', 0.05),
  centreBoost: number('Bigger tiles in the centre', 1.2, 0, 3, 'Layout', 0.1),
  passes: number('Flights through the cloud per loop', 1, 1, 4, 'Camera', 1),
  drift: number('Camera drift', 0.05, 0, 0.3, 'Camera', 0.01),
  blur: number('Far blur (px at 1080)', 0.6, 0, 3, 'Camera', 0.1),
  titleAt: number('Title starts (seconds)', 7, 0, 10, 'Motion', 0.1),
  clearing: number('Clear the tiles behind the title', 1, 0, 1, 'Motion', 0.05),
  [VAR_PREFIX]: text('Runtime variable prefix', CLOUD_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function cloudComponent(): CustomComponent {
  return {
    source: { html: '', css: CLOUD_CSS.trim(), js: `${CLOUD_MODEL.trim()}\n\n${CLOUD_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: CLOUD_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
