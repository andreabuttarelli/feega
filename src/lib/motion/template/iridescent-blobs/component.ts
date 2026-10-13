import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { BLOBS_MODEL } from './model';
import { BLOBS_SHADER } from './shader';
import { BLOBS_VIEW } from './view';
import { BLOBS_CSS } from './style';

export const BLOBS_COMPONENT = 'IridescentBlobs';
export const BLOBS_VAR_PREFIX = 'blobs';

export const BLOBS_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const BLOBS_PROPS: Record<string, PropSpec> = {
  title: text('Title (empty for none)', 'soft matter', { maxLength: 40 }),
  lowercase: flag('Lowercase title', true, 'Content'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  fontSize: number('Title size (% of the short side)', 12, 4, 24, 'Style', 0.5),
  fontWeight: number('Title weight', 600, 300, 800, 'Style', 100),
  tracking: number('Title tracking (em)', -0.04, -0.08, 0.05, 'Style', 0.005),
  titleColor: colour('Title colour', '#ffffff'),
  background: colour('Background', '#000000'),
  body: colour('Body colour', '#7fb6ea'),
  sheen: colour('Sheen colour', '#e2c4ee'),
  rim: colour('Rim colour', '#ff7a52'),
  glow: colour('Inner glow colour', '#3fe08a'),
  bubbles: number('Bubble density', 0.6, 0, 1, 'Layout', 0.05),
  glitter: number('Glitter', 0.5, 0, 1, 'Layout', 0.05),
  mass: number('Mass size', 1, 0.6, 1.5, 'Layout', 0.05),
  seed: number('Arrangement', 3, 1, 99, 'Layout', 1),
  speed: number('Speed (drifts per loop)', 1, 1, 4, 'Motion', 1),
  titleAt: number('Title starts (seconds)', 3, 0, 20, 'Motion', 0.1),
  titleSeconds: number('Title stays (seconds)', 4.5, 1, 20, 'Motion', 0.1),
  [VAR_PREFIX]: text('Runtime variable prefix', BLOBS_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function blobsComponent(): CustomComponent {
  return {
    source: { html: '', css: BLOBS_CSS.trim(), js: `${BLOBS_MODEL.trim()}\n\n${BLOBS_SHADER.trim()}\n\n${BLOBS_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: BLOBS_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
