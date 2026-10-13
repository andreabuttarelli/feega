import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { RIBBON_MODEL } from './model';
import { RIBBON_VIEW } from './view';
import { RIBBON_CSS } from './style';

export const RIBBON_COMPONENT = 'ParticleRibbon';
export const RIBBON_VAR_PREFIX = 'ribbon';

export const RIBBON_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const RIBBON_PROPS: Record<string, PropSpec> = {
  title: text('Title', 'made of motion', { maxLength: 60 }),
  lowercase: flag('Lowercase title', true, 'Content'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  fontSize: number('Title size (% of the short side)', 12, 4, 24, 'Style', 0.5),
  fontWeight: number('Title weight', 600, 300, 800, 'Style', 100),
  tracking: number('Title tracking (em)', -0.04, -0.08, 0.05, 'Style', 0.005),
  background: colour('Background', '#f6f2e6'),
  titleColor: colour('Title colour', '#101418'),
  colorA: colour('Gradient start', '#0a2f8f'),
  colorB: colour('Gradient second stop', '#12aee0'),
  colorC: colour('Gradient third stop', '#79c25a'),
  colorD: colour('Gradient end', '#f7d40c'),
  density: number('Grain density (thousand particles)', 900, 100, 1000, 'Layout', 50),
  grainSize: number('Grain size', 1, 0.5, 3, 'Layout', 0.1),
  twist: number('Twist', 2.4, 0, 6, 'Layout', 0.1),
  dust: number('Dust at the tips', 1, 0, 2, 'Layout', 0.1),
  speed: number('Speed (cycles per loop)', 1, 1, 4, 'Motion', 1),
  titleAt: number('Title starts (seconds)', 3.4, 0, 8, 'Motion', 0.1),
  titleHold: number('Title stays (seconds)', 2.4, 0.5, 6, 'Motion', 0.1),
  [VAR_PREFIX]: text('Runtime variable prefix', RIBBON_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function ribbonComponent(): CustomComponent {
  return {
    source: { html: '', css: RIBBON_CSS.trim(), js: `${RIBBON_MODEL.trim()}\n\n${RIBBON_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: RIBBON_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
