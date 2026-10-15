import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { PD_MODEL } from './model';
import { PD_VIEW } from './view';
import { PD_CSS } from './style';

export const PD_COMPONENT = 'PosterDeckFan';
export const PD_VAR_PREFIX = 'posterdeck';

export const PD_FONTS = ['Inter Tight', 'Archivo', 'Inter', 'Space Grotesk', 'Manrope', 'Geist'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const lines = (title: string, value: string): PropSpec => text(title, value, { format: PropFormat.Textarea, maxLength: 40 });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const PD_PROPS: Record<string, PropSpec> = {
  aTop: text('First poster: top line', 'studio selection', { maxLength: 40 }),
  aTitle: lines('First poster: title (one line per row)', 'open\nform'),
  aBottom: text('First poster: bottom line', 'vol. 03 — 2026', { maxLength: 40 }),
  bTop: text('Second poster: top line', 'design archive', { maxLength: 40 }),
  bTitle: lines('Second poster: title (one line per row)', 'new\nshape'),
  bBottom: text('Second poster: bottom line', 'selected works', { maxLength: 40 }),
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  weight: number('Title weight', 600, 400, 800, 'Style', 100),
  tracking: number('Title tracking (em)', -0.06, -0.1, 0.02, 'Style', 0.005),
  rings: flag('Outline circles over the title', true, 'Style'),
  background: colour('Background', '#cfcfcf'),
  aColor: colour('First poster colour', '#e8553a'),
  bColor: colour('Second poster colour', '#a24cf0'),
  ink: colour('Poster ink', '#0b0f3a'),
  paperColor: colour('Paper card', '#efece4'),
  darkColor: colour('Dark card', '#141414'),
  accentColor: colour('Accent card', '#e9d8c4'),
  placeholderColor: colour('Empty card colour', '#7d7d7d'),
  count: number('Cards', 12, 6, 16, 'Layout', 1),
  cardSize: number('Card size (share of the short side)', 0.56, 0.3, 0.8, 'Layout', 0.01),
  fan: number('Fan opening', 1, 0, 2, 'Layout', 0.05),
  riffleGap: number('Riffle speed (seconds between cards)', 0.12, 0.05, 0.3, 'Motion', 0.01),
  [VAR_PREFIX]: text('Runtime variable prefix', PD_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function pdComponent(): CustomComponent {
  return {
    source: { html: '', css: PD_CSS.trim(), js: `${PD_MODEL.trim()}\n\n${PD_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: PD_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
