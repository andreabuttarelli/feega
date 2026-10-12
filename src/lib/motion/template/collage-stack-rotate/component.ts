import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { COLLAGE_MODEL } from './model';
import { COLLAGE_VIEW } from './view';
import { COLLAGE_CSS } from './style';

export const COLLAGE_COMPONENT = 'CollageStack';
export const COLLAGE_VAR_PREFIX = 'collage';
export const COLLAGE_MAX_CARDS = 10;

export const COLLAGE_FONTS = ['Inter Tight', 'Inter', 'Archivo', 'Space Grotesk', 'Manrope', 'Geist'];

const LABELS = ['Unknown, @fennel', 'Mara Velt, @oreo_lab', 'Studio Halde, @kiln', 'Jun Arata, @pallid', 'Unknown, @mossgrey', 'Teo Ranke, @ruse_02', 'Ivy Calder, @kiln', 'Late Hours, @owl_ink', 'Leni Strom, @borel', 'Otto Weir, @kiln'].join('\n');

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const COLLAGE_PROPS: Record<string, PropSpec> = {
  text: text('Background text', 'keep', { maxLength: 300 }),
  labels: text('Labels (one "creator, @saver" per line)', LABELS, { maxLength: 1200 }),
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  font: { type: 'string', title: 'Letters font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  weight: number('Letters weight', 700, 100, 900, 'Style', 100),
  letterSize: number('Largest letters (% of the short side)', 92, 20, 120, 'Style', 1),
  outline: flag('Outline letters', false, 'Style'),
  background: colour('Background', '#d93b1e'),
  letterColor: colour('Letters colour', '#0b0b0b'),
  labelColor: colour('Labels colour', '#ffffff'),
  paper: colour('Print paper colour', '#e7e7e3'),
  placeholderColor: colour('Empty card colour', '#2a2a2a'),
  count: number('Cards', 8, 1, COLLAGE_MAX_CARDS, 'Layout', 1),
  cardScale: number('Card size', 0.84, 0.6, 1.3, 'Layout', 0.05),
  cardsAt: number('First card (seconds)', 0.3, 0, 4, 'Motion', 0.1),
  gap: number('Time between cards (seconds)', 0.8, 0.3, 2, 'Motion', 0.05),
  labelsAt: number('Labels start (seconds)', 0.6, 0, 4, 'Motion', 0.1),
  leave: flag('Loop: everything leaves at the end', true, 'Motion'),
  [VAR_PREFIX]: text('Runtime variable prefix', COLLAGE_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function collageComponent(): CustomComponent {
  return {
    source: { html: '', css: COLLAGE_CSS.trim(), js: `${COLLAGE_MODEL.trim()}\n\n${COLLAGE_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: COLLAGE_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
