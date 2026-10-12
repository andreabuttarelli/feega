import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { EDITORIAL_MODEL } from './model';
import { EDITORIAL_VIEW } from './view';
import { EDITORIAL_CSS } from './style';

export const EDITORIAL_COMPONENT = 'EditorialWordsMedia';
export const EDITORIAL_VAR_PREFIX = 'editorial';

export const EDITORIAL_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

export const EDITORIAL_PHRASES = 'there / needs to be / a jingle\nevery brand / has a / sound\nmake it / impossible / to forget';

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const EDITORIAL_PROPS: Record<string, PropSpec> = {
  phrases: text('Phrases (one per line, "/" splits the lines of the grid)', EDITORIAL_PHRASES, { format: PropFormat.Textarea, maxLength: 600 }),
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  lowercase: flag('Lowercase', true, 'Content'),
  quote: flag('Closing quote mark', true, 'Content'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  fontSize: number('Text size (share of the short side)', 0.175, 0.06, 0.3, 'Style', 0.005),
  fontWeight: number('Text weight', 500, 300, 800, 'Style', 100),
  tracking: number('Tracking (em)', -0.035, -0.08, 0.05, 'Style', 0.005),
  background: colour('Background', '#000000'),
  textColor: colour('Text colour', '#ffffff'),
  placeholderColor: colour('Empty picture colour', '#1c1c1c'),
  margin: number('Margin (share of the short side)', 0.035, 0, 0.12, 'Layout', 0.005),
  mediaWidth: number('Picture width (share of the width)', 0.27, 0.12, 0.45, 'Layout', 0.01),
  mediaAspect: number('Picture aspect (width / height)', 1.6, 0.6, 2.4, 'Layout', 0.05),
  beat: number('Beat between reveals (seconds)', 0.42, 0.15, 1.2, 'Motion', 0.01),
  lead: number('Lead-in before each phrase (seconds)', 0.15, 0, 1, 'Motion', 0.05),
  [VAR_PREFIX]: text('Runtime variable prefix', EDITORIAL_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function editorialComponent(): CustomComponent {
  return {
    source: { html: '', css: EDITORIAL_CSS.trim(), js: `${EDITORIAL_MODEL.trim()}\n\n${EDITORIAL_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: EDITORIAL_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
