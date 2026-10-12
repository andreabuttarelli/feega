import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { GLOBE_MODEL } from './model';
import { GLOBE_VIEW } from './view';
import { GLOBE_CSS } from './style';

export const GLOBE_COMPONENT = 'ImageGlobe';
export const GLOBE_VAR_PREFIX = 'globe';

export const GLOBE_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const GLOBE_PROPS: Record<string, PropSpec> = {
  title: text('Title', 'the whole world', { maxLength: 80 }),
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  lowercase: flag('Lowercase title', true, 'Content'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  fontSize: number('Title size (% of the short side)', 13, 4, 24, 'Style', 0.5),
  fontWeight: number('Title weight', 600, 300, 800, 'Style', 100),
  tracking: number('Title tracking (em)', -0.05, -0.08, 0.05, 'Style', 0.005),
  background: colour('Background', '#000000'),
  titleColor: colour('Title colour', '#ffffff'),
  placeholderColor: colour('Empty tile colour', '#1a1a1a'),
  tiles: number('Tiles', 28, 8, 60, 'Layout', 1),
  tileSize: number('Tile size (1 fills the sphere)', 0.5, 0.3, 1.2, 'Layout', 0.01),
  tileAspect: number('Tile aspect (width / height)', 0.8, 0.4, 2, 'Layout', 0.05),
  radius: number('Globe radius (share of the short side)', 0.36, 0.15, 0.45, 'Layout', 0.01),
  axisTilt: number('Axis tilt (degrees, seen from above)', 14, -40, 40, 'Camera', 1),
  backDim: number('Dim tiles facing away', 0.95, 0, 1, 'Camera', 0.05),
  globeDim: number('Dim the globe under the title', 0.45, 0, 0.9, 'Camera', 0.05),
  push: number('Camera push-in', 0.12, 0, 0.4, 'Camera', 0.01),
  turns: number('Rotation (turns per loop)', 1, 0, 4, 'Motion', 1),
  assembleAt: number('Globe starts (seconds)', 0, 0, 4, 'Motion', 0.1),
  assembleSeconds: number('Tile entrance (seconds)', 1.4, 0.4, 3, 'Motion', 0.1),
  stagger: number('Tile stagger, first to last (seconds)', 1.2, 0, 3, 'Motion', 0.1),
  titleAt: number('Title starts (seconds)', 2.4, 0, 8, 'Motion', 0.1),
  leave: flag('Loop: everything leaves at the end', true, 'Motion'),
  [VAR_PREFIX]: text('Runtime variable prefix', GLOBE_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function globeComponent(): CustomComponent {
  return {
    source: { html: '', css: GLOBE_CSS.trim(), js: `${GLOBE_MODEL.trim()}\n\n${GLOBE_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: GLOBE_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
