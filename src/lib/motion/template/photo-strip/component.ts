import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { STRIP_MODEL } from './model';
import { STRIP_VIEW } from './view';
import { STRIP_CSS } from './style';

export const STRIP_COMPONENT = 'PhotoStrip';
export const STRIP_VAR_PREFIX = 'strip';

export enum StripDirection {
  Left = 'left',
  Right = 'right'
}

export const STRIP_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const STRIP_PROPS: Record<string, PropSpec> = {
  media: text('Photos (ids or links, comma separated)', '', { format: PropFormat.Textarea, maxLength: 2000 }),
  captions: text('Captions (comma separated, one per photo)', '', { format: PropFormat.Textarea, maxLength: 1000 }),
  lowercase: flag('Lowercase captions', true, 'Content'),
  font: { type: 'string', title: 'Caption font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  captionSize: number('Caption size (% of the short side)', 3.2, 1, 8, 'Style', 0.1),
  captionWeight: number('Caption weight', 500, 300, 800, 'Style', 100),
  tracking: number('Caption tracking (em)', -0.04, -0.08, 0.05, 'Style', 0.005),
  background: colour('Background', '#000000'),
  captionColor: colour('Caption colour', '#ffffff'),
  placeholderColor: colour('Empty card colour', '#161616'),
  radius: number('Card radius (%, 50 is a circle)', 0, 0, 50, 'Style', 1),
  shadow: number('Card shadow', 1, 0, 2, 'Style', 0.1),
  count: number('Cards (when no photos are set)', 10, 1, 12, 'Layout', 1),
  cardSize: number('Card width (share of the short side)', 0.24, 0.1, 0.4, 'Layout', 0.01),
  aspect: number('Card aspect (width / height)', 0.8, 0.5, 1.8, 'Layout', 0.05),
  gap: number('Gap (share of the short side)', 0.035, 0, 0.12, 'Layout', 0.005),
  magnify: number('Magnifier scale', 1.75, 1, 2.5, 'Motion', 0.05),
  falloff: number('Magnifier width (cards)', 1.2, 0.4, 3, 'Motion', 0.1),
  lift: number('Lift of the magnified card', 0.04, 0, 0.12, 'Motion', 0.005),
  step: number('Cards per gesture', 1.5, 1, 4, 'Motion', 0.5),
  gesture: number('Gesture length (seconds)', 1.2, 0.5, 3, 'Motion', 0.05),
  pause: number('Pause on a card (seconds)', 0.45, 0.1, 2, 'Motion', 0.05),
  direction: { type: 'string', title: 'Direction', enum: Object.values(StripDirection), default: StripDirection.Left, group: 'Motion' },
  captionLead: number('Caption lead (share of the gesture)', 0.4, 0.05, 0.9, 'Motion', 0.05),
  cursor: flag('Show the dragging cursor', false, 'Motion'),
  cursorColor: colour('Cursor colour', '#ffffff'),
  drag: flag('Viewers can drag the strip (embeds)', true, 'Motion'),
  [VAR_PREFIX]: text('Runtime variable prefix', STRIP_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function stripComponent(): CustomComponent {
  return {
    source: { html: '', css: STRIP_CSS.trim(), js: `${STRIP_MODEL.trim()}\n\n${STRIP_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: STRIP_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
