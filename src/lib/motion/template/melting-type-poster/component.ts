import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { MELT_MODEL } from './model';
import { MELT_VIEW } from './view';
import { MELT_CSS } from './style';

export const MELT_COMPONENT = 'MeltingTypePoster';
export const MELT_VAR_PREFIX = 'melt';

export const MELT_FONTS = ['Inter', 'Inter Tight', 'Geist', 'Instrument Sans', 'Manrope', 'DM Sans', 'Space Grotesk'];

const BODY_EN =
  'Every printed line once had a body. Letters were cast in metal, set by hand and locked into a frame, and a single page of type could outweigh the book it made.\n\nThe gaps were cast too. Blank pieces held the lines apart, so that even the silence on a page was something a printer could lift.\n\nWhen the job was done the page came apart and each letter went home to its case. The words melted back into metal, and the metal waited to become words again.';

const BODY_DE =
  'Jede gedruckte Zeile hatte einst einen Körper. Buchstaben wurden in Metall gegossen, von Hand gesetzt und in einen Rahmen geschlossen, und eine einzige Seite Satz wog mehr als das Buch, das sie druckte.\n\nAuch die Lücken wurden gegossen. Blinde Stücke hielten die Zeilen auseinander, sodass selbst die Stille einer Seite etwas war, das ein Drucker heben konnte.\n\nNach dem Druck wurde die Seite zerlegt, und jeder Buchstabe kehrte in seinen Kasten zurück. Die Wörter schmolzen zu Metall, und das Metall wartete darauf, wieder Wörter zu werden.';

const text = (title: string, value: string, maxLength = 120): PropSpec => ({ type: 'string', title, default: value, group: 'Content', maxLength });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const MELT_PROPS: Record<string, PropSpec> = {
  title: text('Title', 'The Shape\nof Silence', 60),
  subtitle: text('Translated title', 'Die Form\nder Stille', 60),
  index: text('Index', 'A4', 6),
  kicker: text('Top note (melts first)', 'Lead, tin, antimony.\nBlei, Zinn, Antimon.'),
  bodyLeft: text('Body, left column', BODY_EN, 900),
  bodyRight: text('Body, right column', BODY_DE, 900),
  footer: text('Footer', 'Set matter is temporary. The type goes back.\nSatz ist vergänglich. Die Lettern kehren zurück.', 200),
  credit: text('Side credit', 'halftype press / issue 04', 60),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  page: colour('Page', '#111111'),
  surround: colour('Around the page', '#8c8c8c'),
  ink: colour('Ink', '#f2f2f2'),
  strength: number('Melt strength', 1, 0, 1, 'Motion', 0.05),
  reach: number('Drip length (share of the page)', 0.65, 0.1, 1, 'Motion', 0.05),
  columnWidth: number('Drip width (‰ of the page)', 4.5, 1.5, 12, 'Motion', 0.5),
  meltAt: number('Melt starts (seconds)', 0.6, 0, 6, 'Motion', 0.1),
  holdFor: number('Melted hold (seconds)', 2, 0, 6, 'Motion', 0.1),
  spread: number('Column stagger (seconds)', 1.4, 0, 4, 'Motion', 0.1),
  [VAR_PREFIX]: text('Runtime variable prefix', MELT_VAR_PREFIX, 20)
};

export function meltComponent(): CustomComponent {
  return {
    source: { html: '', css: MELT_CSS.trim(), js: `${MELT_MODEL.trim()}\n\n${MELT_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: MELT_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
