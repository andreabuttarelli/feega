import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { ROWS_MODEL } from './model';
import { ROWS_VIEW } from './view';
import { ROWS_CSS } from './style';

export const ROWS_COMPONENT = 'RowsSpacedTitle';
export const ROWS_VAR_PREFIX = 'rows';

export enum RowsDirection {
  Left = 'left',
  Right = 'right'
}

export const ROWS_FONTS = ['Inter', 'Inter Tight', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const ROWS_PROPS: Record<string, PropSpec> = {
  title: text('Title', 'Submit your ad today', { maxLength: 80 }),
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  lowercase: flag('Lowercase title', false, 'Content'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  fontSize: number('Title size (% of the short side)', 5.6, 2, 14, 'Style', 0.1),
  fontWeight: number('Title weight', 400, 300, 800, 'Style', 100),
  tracking: number('Title tracking (em)', -0.02, -0.08, 0.05, 'Style', 0.005),
  background: colour('Background', '#000000'),
  titleColor: colour('Title colour', '#ffffff'),
  placeholderColor: colour('Empty card colour', '#1a1a1a'),
  radius: number('Card radius (%, 50 is a circle)', 0, 0, 50, 'Style', 1),
  count: number('Cards (when no photos are set)', 10, 1, 24, 'Layout', 1),
  cardSize: number('Card size (share of the short side)', 0.21, 0.08, 0.4, 'Layout', 0.01),
  gap: number('Gap between cards (share of the short side)', 0.19, 0, 0.5, 'Layout', 0.01),
  margin: number('Rows distance from the edge (share of the short side)', 0.02, 0, 0.3, 'Layout', 0.005),
  spacing: number('Space between words (share of the short side)', 0.135, 0, 0.4, 'Layout', 0.005),
  speed: number('Row speed (cards per second)', 0.42, 0, 3, 'Motion', 0.01),
  direction: { type: 'string', title: 'Top row direction', enum: Object.values(RowsDirection), default: RowsDirection.Left, group: 'Motion' },
  delay: number('Title delay (seconds)', 0.5, 0, 4, 'Motion', 0.05),
  stagger: number('Delay between words (seconds)', 0.32, 0, 1.5, 'Motion', 0.01),
  tighten: number('Spacing closing (0 keeps it, 1 closes it)', 0, 0, 1, 'Motion', 0.05),
  [VAR_PREFIX]: text('Runtime variable prefix', ROWS_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function rowsComponent(): CustomComponent {
  return {
    source: { html: '', css: ROWS_CSS.trim(), js: `${ROWS_MODEL.trim()}\n\n${ROWS_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: ROWS_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
