import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { PAPER_MODEL } from './model';
import { PAPER_VIEW } from './view';
import { PAPER_CSS } from './style';

export const PAPER_COMPONENT = 'PaperCutouts';
export const PAPER_VAR_PREFIX = 'paper';

export const PAPER_FONTS = ['Inter', 'Inter Tight', 'Geist', 'Instrument Sans', 'Manrope', 'DM Sans'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', maxLength: 120, ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const PAPER_PROPS: Record<string, PropSpec> = {
  from: number('Counter starts at', 430000, 0, 1000000000, 'Content', 1),
  to: number('Counter ends at', 490000, 0, 1000000000, 'Content', 1),
  prefix: text('Before each number', '$', { maxLength: 6 }),
  lines: number('Lines in the counter', 7, 2, 9, 'Content', 1),
  media: text('Picture or video on the cutout', '', { format: PropFormat.Media, maxLength: 2000 }),
  brand: text('Brand', 'lumo'),
  leftLabel: text('Left label', 'Paper coll.'),
  centreLabel: text('Centre label', 'lumo studio'),
  rightLabel: text('Right label', '/ 26'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  background: colour('Background', '#dedede'),
  panelColor: colour('Counter panel colour', '#1c0736'),
  numberColor: colour('Number colour', '#d9ccff'),
  cutoutColor: colour('Cutout colour', '#f26a1b'),
  paperColor: colour('Paper colour', '#f4f4f2'),
  inkColor: colour('Sketch colour', '#121212'),
  badgeColor: colour('Badge colour', '#2f5bff'),
  crumple: number('Crumple depth', 1, 0, 2, 'Layout', 0.05),
  startAt: number('First line (seconds)', 0.5, 0, 3, 'Motion', 0.1),
  lineSeconds: number('Time between lines (seconds)', 0.9, 0.3, 2, 'Motion', 0.05),
  [VAR_PREFIX]: text('Runtime variable prefix', PAPER_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function paperComponent(): CustomComponent {
  return {
    source: { html: '', css: PAPER_CSS.trim(), js: `${PAPER_MODEL.trim()}\n\n${PAPER_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: PAPER_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
