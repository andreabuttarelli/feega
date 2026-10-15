import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { CC_MODEL } from './model';
import { CC_VIEW } from './view';
import { CC_CSS } from './style';

export const CC_COMPONENT = 'CardCascade';
export const CC_VAR_PREFIX = 'cascade';

export const CC_FONTS = ['Inter Tight', 'Inter', 'Archivo', 'Geist', 'Manrope', 'Space Grotesk'];

const WORDS = ['Experience', 'Design', 'Expertise', 'Comfort', 'Modular', 'Colour', 'Texture', 'Craft'].join('\n');
const TYPE_LINES = ['Make', '2026', 'Now', 'Bold'].join('\n');

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const CC_PROPS: Record<string, PropSpec> = {
  typeLines: text('Type card (one word per line)', TYPE_LINES, { format: PropFormat.Textarea, maxLength: 80 }),
  words: text('Word list (one per line)', WORDS, { format: PropFormat.Textarea, maxLength: 300 }),
  letter: text('Big letter', 'A', { maxLength: 2 }),
  tag: text('Colour card label', 'index', { maxLength: 24 }),
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  weight: number('Type card weight', 600, 400, 800, 'Style', 100),
  tracking: number('Type card tracking (em)', -0.05, -0.08, 0.02, 'Style', 0.005),
  background: colour('Background', '#e2e2e2'),
  ink: colour('Type card text', '#0d0d0d'),
  typeColor: colour('Type card', '#c4c4c4'),
  listColor: colour('Word list card', '#0b0b0b'),
  letterColor: colour('Letter card', '#d3281c'),
  tagColor: colour('Colour card', '#2f55ff'),
  placeholderColor: colour('Empty card colour', '#bdbdbd'),
  count: number('Cards', 8, 5, 10, 'Layout', 1),
  cardSize: number('Card size (share of the short side)', 0.34, 0.2, 0.5, 'Layout', 0.01),
  spread: number('Spacing along the diagonal', 0.78, 0.6, 1.6, 'Layout', 0.05),
  radius: number('Corner radius (%)', 6, 0, 20, 'Layout', 0.5),
  stepSeconds: number('Step length (seconds)', 1.1, 0.5, 2, 'Motion', 0.05),
  stagger: number('Gap between cards in a step (seconds)', 0.06, 0, 0.2, 'Motion', 0.01),
  [VAR_PREFIX]: text('Runtime variable prefix', CC_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function ccComponent(): CustomComponent {
  return {
    source: { html: '', css: CC_CSS.trim(), js: `${CC_MODEL.trim()}\n\n${CC_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: CC_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
