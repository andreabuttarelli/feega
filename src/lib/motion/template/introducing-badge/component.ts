import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { BADGE_MODEL } from './model';
import { BADGE_VIEW } from './view';
import { BADGE_CSS } from './style';

export const BADGE_COMPONENT = 'IntroducingBadge';
export const BADGE_VAR_PREFIX = 'badge';

export const BADGE_FONTS = ['Inter', 'Inter Tight', 'Geist', 'Instrument Sans', 'Manrope', 'DM Sans', 'Space Grotesk'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', maxLength: 40, ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const BADGE_PROPS: Record<string, PropSpec> = {
  intro: text('Lead word', 'Introducing'),
  brand: text('Badge wordmark (bold)', 'NOVA', { maxLength: 20 }),
  brandSuffix: text('Badge wordmark (light)', 'kit', { maxLength: 20 }),
  product: text('Product name', 'Nova Icons'),
  logo: text('Badge logo', '', { format: PropFormat.Media, maxLength: 2000 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  fontSize: number('Text size (% of the short side)', 5.2, 2, 10, 'Style', 0.1),
  fontWeight: number('Text weight', 400, 300, 700, 'Style', 100),
  tracking: number('Text tracking (em)', -0.02, -0.08, 0.05, 'Style', 0.005),
  background: colour('Background', '#020504'),
  textColor: colour('Text colour', '#f1f4f3'),
  accent: colour('Accent colour', '#62d2a6'),
  glow: colour('Planet glow', '#2c6b55'),
  arcRise: number('Planet rise (share of the frame)', 0.08, 0, 0.3, 'Motion', 0.01),
  introAt: number('Lead word starts (seconds)', 0.4, 0, 4, 'Motion', 0.1),
  badgeAt: number('Badge starts (seconds)', 0.9, 0, 4, 'Motion', 0.1),
  nameAt: number('Product name starts (seconds)', 1.5, 0, 5, 'Motion', 0.1),
  leave: { type: 'boolean', title: 'Loop: everything leaves at the end', default: true, group: 'Motion' },
  [VAR_PREFIX]: text('Runtime variable prefix', BADGE_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function badgeComponent(): CustomComponent {
  return {
    source: { html: '', css: BADGE_CSS.trim(), js: `${BADGE_MODEL.trim()}\n\n${BADGE_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: BADGE_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
