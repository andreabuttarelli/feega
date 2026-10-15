import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { PS_MODEL } from './model';
import { PS_VIEW } from './view';
import { PS_CSS } from './style';

export const PS_COMPONENT = 'PerspectiveStack';
export const PS_VAR_PREFIX = 'deck';

export const PS_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Manrope', 'DM Sans'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const PS_PROPS: Record<string, PropSpec> = {
  caption: text('Caption', 'new arrival', { maxLength: 40 }),
  media: text('Product pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  captionSize: number('Caption size (% of the short side)', 2.6, 1, 8, 'Style', 0.1),
  background: colour('Background', '#f3f3f3'),
  ink: colour('Caption colour', '#111111'),
  productCard: colour('Product card', '#e6e6e6'),
  colourA: colour('Card colour 1', '#5b9ce4'),
  colourB: colour('Card colour 2', '#2a2f35'),
  colourC: colour('Card colour 3', '#9db8d6'),
  floorBack: colour('Lower back card', '#3b6766'),
  floorFront: colour('Lower front card', '#151716'),
  liquidA: colour('Liquid colour 1', '#47b4ff'),
  liquidB: colour('Liquid colour 2', '#ff7b2e'),
  liquidC: colour('Liquid colour 3', '#e8f4ff'),
  count: number('Cards in the deck', 5, 3, 7, 'Layout', 1),
  deckSize: number('Card size (share of the short side)', 0.5, 0.3, 0.7, 'Layout', 0.01),
  radius: number('Corner radius (%)', 4, 0, 15, 'Layout', 0.5),
  tilt: number('Deck tilt (degrees)', 14, 0, 40, 'Layout', 1),
  floorTilt: number('Lower cards tilt (degrees)', 38, 0, 70, 'Layout', 1),
  flip: number('Flip length (seconds)', 1.3, 0.6, 2.4, 'Motion', 0.1),
  [VAR_PREFIX]: text('Runtime variable prefix', PS_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function psComponent(): CustomComponent {
  return {
    source: { html: '', css: PS_CSS.trim(), js: `${PS_MODEL.trim()}\n\n${PS_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: PS_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
