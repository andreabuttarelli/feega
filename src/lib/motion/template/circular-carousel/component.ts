import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { CAROUSEL_MODEL } from './model';
import { CAROUSEL_VIEW } from './view';
import { CAROUSEL_CSS } from './style';

export const CAROUSEL_COMPONENT = 'CircularCarousel';
export const CAROUSEL_VAR_PREFIX = 'carousel';

export const CAROUSEL_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

export enum CarouselDirection {
  Next = 'next',
  Previous = 'previous'
}

export enum ButtonStyle {
  Glass = 'glass',
  Solid = 'solid',
  Outline = 'outline'
}

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });
const choice = (title: string, options: string[], value: string, group: PropSpec['group']): PropSpec => ({ type: 'string', title, enum: options, default: value, group });

export const CAROUSEL_PROPS: Record<string, PropSpec> = {
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  captions: text('Captions (comma separated, one per item)', '', { format: PropFormat.Textarea, maxLength: 1000 }),
  lowercase: flag('Lowercase captions', true, 'Content'),
  background: colour('Background', '#0a0a0a'),
  placeholderColor: colour('Empty item colour', '#1c1c1c'),
  captionColor: colour('Caption colour', '#ffffff'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  captionSize: number('Caption size (% of the short side)', 3.4, 1.5, 8, 'Style', 0.1),
  captionWeight: number('Caption weight', 500, 300, 800, 'Style', 100),
  tracking: number('Caption tracking (em)', -0.04, -0.08, 0.05, 'Style', 0.005),
  itemSize: number('Item height (share of the short side)', 0.52, 0.2, 0.8, 'Layout', 0.01),
  aspect: number('Item aspect (width / height)', 0.75, 0.4, 2, 'Layout', 0.05),
  radius: number('Corner radius (% of item width, 50 = circle)', 0, 0, 50, 'Layout', 50),
  shadow: number('Shadow', 0.35, 0, 1, 'Layout', 0.05),
  gap: number('Gap between items (share of item width)', 0.14, 0, 1, 'Layout', 0.01),
  ringRadius: number('Ring radius (share of the short side)', 0.8, 0.3, 3, 'Camera', 0.05),
  perspective: number('Perspective (share of the short side)', 2.6, 1, 8, 'Camera', 0.1),
  tilt: number('Camera tilt (degrees)', 0, -20, 20, 'Camera', 1),
  visible: number('Visible items', 7, 1, 11, 'Camera', 2),
  dim: number('Dim items further back', 0.7, 0, 1, 'Camera', 0.05),
  lift: number('Front item lift', 0.06, 0, 0.3, 'Camera', 0.01),
  autoplay: flag('Autoplay (pauses while someone interacts)', true, 'Motion'),
  interval: number('Seconds per item', 2.4, 1, 10, 'Motion', 0.1),
  moveSeconds: number('Turn duration (seconds)', 1.1, 0.3, 3, 'Motion', 0.05),
  direction: choice('Direction', Object.values(CarouselDirection), CarouselDirection.Next, 'Motion'),
  buttons: flag('Previous / next buttons', true, 'Motion'),
  buttonStyle: choice('Button style', Object.values(ButtonStyle), ButtonStyle.Glass, 'Style'),
  buttonColor: colour('Button colour', '#ffffff'),
  drag: flag('Drag to turn', true, 'Motion'),
  [VAR_PREFIX]: text('Runtime variable prefix', CAROUSEL_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function carouselComponent(): CustomComponent {
  return {
    source: { html: '', css: CAROUSEL_CSS.trim(), js: `${CAROUSEL_MODEL.trim()}\n\n${CAROUSEL_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: CAROUSEL_PROPS },
    mode: ComponentMode.Live,
    version: 1,
    check: null
  };
}
