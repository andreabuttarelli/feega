import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { PATH_MODEL } from './model';
import { PATH_VIEW } from './view';
import { PATH_CSS } from './style';

export const PATH_COMPONENT = 'PathCards';
export const PATH_VAR_PREFIX = 'path';

export const PATH_FONTS = ['Inter', 'Inter Tight', 'Geist', 'Instrument Sans', 'Manrope', 'DM Sans'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', maxLength: 600, ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const PATH_PROPS: Record<string, PropSpec> = {
  places: text('Places, separated by |', 'Fjord Point|Red Rock Ridge|Misty Pass'),
  media: text('Place pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  addresses: text('Addresses, separated by |', '12 Harbour Rd, Norrvik|4 Canyon Trail, Mesa Alta|North Ridge, Glen Arran'),
  ratings: text('Ratings, separated by |', '4,8|4,6|4,9'),
  reviewers: text('Reviewers, separated by |', 'Mara Quinn|Theo Lind|Ines Park'),
  reviews: text('Reviews, separated by |', 'The view at sunrise was worth every step of the climb.|Warm rock, wide sky, and not a soul around.|Clouds rolled in and out like a slow film.'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  background: colour('Background', '#f6f7fa'),
  cardColor: colour('Card colour', '#ffffff'),
  ink: colour('Text colour', '#16181d'),
  accent: colour('Path colour', '#3d74e8'),
  starColor: colour('Star colour', '#f4b81c'),
  pathWidth: number('Path width (% of the short side)', 0.5, 0.2, 1.5, 'Layout', 0.05),
  cardSize: number('Card size', 1, 0.6, 1.4, 'Layout', 0.05),
  blur: number('Depth blur on far cards (px)', 3, 0, 8, 'Camera', 0.5),
  startAt: number('Path starts (seconds)', 0.5, 0, 3, 'Motion', 0.1),
  moveSeconds: number('Travel between stops (seconds)', 1.6, 0.6, 4, 'Motion', 0.1),
  holdSeconds: number('Hold on each stop (seconds)', 0.9, 0, 3, 'Motion', 0.1),
  leave: { type: 'boolean', title: 'Loop: everything leaves at the end', default: true, group: 'Motion' },
  [VAR_PREFIX]: text('Runtime variable prefix', PATH_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function pathComponent(): CustomComponent {
  return {
    source: { html: '', css: PATH_CSS.trim(), js: `${PATH_MODEL.trim()}\n\n${PATH_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: PATH_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
