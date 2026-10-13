import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { STACK_MODEL } from './model';
import { STACK_VIEW } from './view';
import { STACK_CSS } from './style';

export const STACK_COMPONENT = 'StackWords';
export const STACK_VAR_PREFIX = 'stack';

export const STACK_FONTS = ['Inter', 'Inter Tight', 'Geist', 'Instrument Sans', 'Manrope', 'DM Sans', 'Space Grotesk', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const STACK_PROPS: Record<string, PropSpec> = {
  words: text('Words ("/" splits the word above from the word below)', 'gets / better', { maxLength: 80 }),
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  cards: number('Cards', 5, 1, 12, 'Content', 1),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  fontSize: number('Text size (share of the short side)', 0.075, 0.03, 0.16, 'Style', 0.005),
  fontWeight: number('Text weight', 400, 300, 800, 'Style', 100),
  tracking: number('Tracking (em)', -0.03, -0.08, 0.05, 'Style', 0.005),
  background: colour('Background', '#ececec'),
  textColor: colour('Text colour', '#0d0d0d'),
  placeholderColor: colour('Empty picture colour', '#d6d6d6'),
  cardHeight: number('Card height (share of the height)', 0.56, 0.25, 0.8, 'Layout', 0.01),
  cardAspect: number('Card aspect (width / height)', 0.8, 0.5, 1.5, 'Layout', 0.05),
  overlap: number('Overlap between cards', 0.42, 0, 0.85, 'Layout', 0.01),
  beat: number('Beat between cards (seconds)', 0.75, 0.3, 1.5, 'Motion', 0.05),
  lead: number('Lead-in (seconds)', 0.3, 0, 1, 'Motion', 0.05),
  [VAR_PREFIX]: text('Runtime variable prefix', STACK_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function stackComponent(): CustomComponent {
  return {
    source: { html: '', css: STACK_CSS.trim(), js: `${STACK_MODEL.trim()}\n\n${STACK_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: STACK_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
