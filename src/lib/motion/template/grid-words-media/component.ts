import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { GRID_MODEL } from './model';
import { GRID_VIEW } from './view';
import { GRID_CSS } from './style';

export const GRID_COMPONENT = 'GridWordsMedia';
export const GRID_VAR_PREFIX = 'gridwords';

export const GRID_FONTS = ['Libre Caslon Text', 'Libre Baskerville', 'EB Garamond', 'Newsreader', 'Instrument Serif', 'Inter'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const GRID_PROPS: Record<string, PropSpec> = {
  phrases: text('Sentences (one per line, revealed word by word)', 'this will never be the same', { format: PropFormat.Textarea, maxLength: 400 }),
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  lowercase: { type: 'boolean', title: 'Lowercase', default: true, group: 'Content' },
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Libre Caslon Text', group: 'Style' },
  textSize: number('Text size (share of a grid cell)', 0.5, 0.25, 0.8, 'Style', 0.01),
  fontWeight: number('Text weight', 400, 300, 700, 'Style', 100),
  tracking: number('Tracking (em)', -0.01, -0.06, 0.06, 'Style', 0.005),
  background: colour('Background', '#efeeec'),
  lineColor: colour('Grid lines', '#d6d5d2'),
  chipColor: colour('Word chip', '#ffffff'),
  textColor: colour('Text colour', '#111111'),
  placeholderColor: colour('Empty picture colour', '#d6d4d0'),
  cells: number('Grid cells across the short side', 9, 5, 16, 'Layout', 1),
  seed: number('Scatter (change to rearrange)', 7, 0, 999, 'Layout', 1),
  beat: number('Beat between reveals (seconds)', 0.5, 0.2, 1.2, 'Motion', 0.01),
  lead: number('Lead-in before each sentence (seconds)', 0.4, 0, 1.5, 'Motion', 0.05),
  [VAR_PREFIX]: text('Runtime variable prefix', GRID_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function gridComponent(): CustomComponent {
  return {
    source: { html: '', css: GRID_CSS.trim(), js: `${GRID_MODEL.trim()}\n\n${GRID_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: GRID_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
