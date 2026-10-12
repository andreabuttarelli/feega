import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { MARQUEE_MODEL } from './model';
import { MARQUEE_VIEW } from './view';
import { MARQUEE_CSS } from './style';

export const MARQUEE_COMPONENT = 'Marquee';
export const MARQUEE_VAR_PREFIX = 'marquee';

export enum MarqueeDirection {
  Left = 'left',
  Right = 'right',
  Up = 'up',
  Down = 'down'
}

export enum MarqueeContent {
  LogosAndQuotes = 'logos + quotes',
  Logos = 'logos',
  Images = 'images',
  Quotes = 'quotes',
  ImagesAndQuotes = 'images + quotes'
}

export const MARQUEE_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const WORDMARKS = 'Halcyon, orbitly, KESTREL, Paperplane, vesta, Fieldnote, monoline, Northstack';

const QUOTES = [
  'We shipped the launch video in an afternoon. — Mara Lindqvist, Halcyon',
  'Our signups doubled the week it went live. — Tomás Reyes, Orbitly',
  'Finally, motion that looks like our brand. — Priya Natarajan, Kestrel',
  'The team stopped waiting on the agency. — Jonah Feld, Paperplane',
  'It feels made by a studio, not a tool. — Ines Okafor, Vesta'
].join('\n');

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });
const choice = (title: string, values: string[], value: string, group: PropSpec['group']): PropSpec => ({ type: 'string', title, enum: values, default: value, group });

export const MARQUEE_PROPS: Record<string, PropSpec> = {
  media: text('Logos or images', '', { format: PropFormat.Media, maxLength: 2000 }),
  quotes: text('Testimonials (one per line: quote — name)', QUOTES, { format: PropFormat.Textarea, maxLength: 2000 }),
  wordmarks: text('Names shown when no logos are set (comma separated)', WORDMARKS, { maxLength: 400 }),
  content: choice('Content', Object.values(MarqueeContent), MarqueeContent.LogosAndQuotes, 'Content'),
  rows: number('Rows', 2, 1, 4, 'Layout', 1),
  direction: choice('Direction', Object.values(MarqueeDirection), MarqueeDirection.Left, 'Motion'),
  alternate: flag('Rows run opposite ways', true, 'Motion'),
  speed: number('Speed (share of the short side per second)', 0.08, 0.01, 0.6, 'Motion', 0.01),
  gap: number('Gap (share of the short side)', 0.05, 0, 0.3, 'Layout', 0.005),
  rowGap: number('Row gap (share of the short side)', 0.06, 0, 0.3, 'Layout', 0.005),
  itemSize: number('Logo height (share of the short side)', 0.09, 0.02, 0.25, 'Layout', 0.005),
  quoteWidth: number('Testimonial width (share of the short side)', 0.62, 0.2, 1, 'Layout', 0.01),
  monochrome: flag('Monochrome logos', false, 'Style'),
  logoOpacity: number('Logo opacity', 0.9, 0.1, 1, 'Style', 0.05),
  fade: number('Edge fade (share of the width)', 0.14, 0, 0.45, 'Style', 0.01),
  background: colour('Background', '#0a0a0a'),
  ink: colour('Text and logo colour', '#f5f5f5'),
  cardColor: colour('Testimonial card colour', '#161616'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  quoteSize: number('Testimonial text size (% of the short side)', 3.2, 1, 6, 'Style', 0.1),
  weight: number('Text weight', 500, 300, 800, 'Style', 100),
  tracking: number('Tracking (em)', -0.04, -0.08, 0.05, 'Style', 0.005),
  pauseOnHover: flag('Pause on hover', false, 'Motion'),
  drag: flag('Drag to scrub', true, 'Motion'),
  glide: number('Glide after release (seconds)', 0.7, 0.1, 3, 'Motion', 0.05),
  [VAR_PREFIX]: text('Runtime variable prefix', MARQUEE_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function marqueeComponent(): CustomComponent {
  return {
    source: { html: '', css: MARQUEE_CSS.trim(), js: `${MARQUEE_MODEL.trim()}\n\n${MARQUEE_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: MARQUEE_PROPS },
    mode: ComponentMode.Live,
    version: 1,
    check: null
  };
}
