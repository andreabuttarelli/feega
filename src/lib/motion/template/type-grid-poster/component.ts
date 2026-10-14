import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { TYPE_GRID_VIEW } from './view';
import { TYPE_GRID_CSS } from './style';

export const TYPE_GRID_COMPONENT = 'TypeGridPoster';
export const TYPE_GRID_VAR_PREFIX = 'typegrid';

export const TYPE_GRID_FONTS = ['Inter Tight', 'Inter', 'Instrument Sans', 'Space Grotesk', 'Geist', 'Manrope', 'DM Sans'];

const LINES = ['STUDIO', 'NAME [photo]', 'SPACE [photo]', 'SESSION', '01 [photo] ->', '01-26 7PM'].join('\n');

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const lines = (title: string, value: string): PropSpec => text(title, value, { format: PropFormat.Textarea, maxLength: 400 });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const TYPE_GRID_PROPS: Record<string, PropSpec> = {
  lines: lines('Big type lines ([photo] picture, -> arrow)', LINES),
  footer1: lines('Footer column 1', '23 Mar\n2027'),
  footer2: lines('Footer column 2', '30 Apr\n2027'),
  footer3: lines('Footer column 3', 'Studio Name\nCity'),
  footer4: lines('Footer column 4', 'Venue name,\nStreet 00'),
  issue: text('Stamp above the footer', 'ISSUE 04 / SPRING', { maxLength: 30 }),
  caption: text('Vertical caption, right edge', 'studio sessions — open to all', { maxLength: 60 }),
  media: text('Pictures, one per inline photo', '', { format: PropFormat.Media, maxLength: 2000 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  fontWeight: number('Type weight', 700, 300, 900, 'Style', 100),
  tracking: number('Type tracking (em)', -0.035, -0.1, 0.05, 'Style', 0.005),
  paper: colour('Poster colour', '#e4ff00'),
  ink: colour('Type colour', '#161616'),
  arrowColor: colour('Arrow colour', '#161616'),
  photoTint: colour('Photo tint', '#4f5a00'),
  fill: number('Widest line (share of the width)', 0.88, 0.5, 1, 'Layout', 0.01),
  leading: number('Line height (em)', 0.92, 0.75, 1.3, 'Layout', 0.01),
  margin: number('Margin (% of the width)', 4.5, 0, 12, 'Layout', 0.5),
  footerSize: number('Footer size (% of the width)', 2.2, 1, 5, 'Layout', 0.1),
  photoGrain: number('Photo grain', 0.55, 0, 1, 'Style', 0.05),
  [VAR_PREFIX]: text('Runtime variable prefix', TYPE_GRID_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function typeGridComponent(): CustomComponent {
  return {
    source: { html: '', css: TYPE_GRID_CSS.trim(), js: TYPE_GRID_VIEW.trim() },
    propsSchema: { type: 'object', properties: TYPE_GRID_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
