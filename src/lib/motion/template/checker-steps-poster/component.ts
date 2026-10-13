import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { CHECKER_VIEW } from './view';
import { CHECKER_CSS } from './style';

export const CHECKER_COMPONENT = 'CheckerStepsPoster';
export const CHECKER_VAR_PREFIX = 'checker';

export const CHECKER_FONTS = ['Inter Tight', 'Inter', 'Instrument Sans', 'Space Grotesk', 'Geist', 'Manrope', 'DM Sans'];

const TITLE = ['Take', 'small', 'steps', 'at a', 'time'].join('\n');
const BODY = 'Break a big goal into small, manageable tasks and each one becomes a step you can see. Small steps build momentum, and momentum builds the confidence to take on larger challenges. One step at a time.';

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const CHECKER_PROPS: Record<string, PropSpec> = {
  title: text('Title, one step per line', TITLE, { format: PropFormat.Textarea, maxLength: 200 }),
  body: text('Text block, top right', BODY, { format: PropFormat.Textarea, maxLength: 600 }),
  index: text('Index line, top left', 'NO. 12 — SERIES ON HABITS'),
  marker: text('Number in the circle', '05', { maxLength: 4 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  fontWeight: number('Title weight', 700, 300, 900, 'Style', 100),
  tracking: number('Title tracking (em)', -0.045, -0.1, 0.05, 'Style', 0.005),
  checker: colour('Checker colour', '#2453f0'),
  paper: colour('Paper colour', '#ffffff'),
  ink: colour('Type colour', '#141414'),
  wear: number('Worn print', 0.6, 0, 1, 'Style', 0.05),
  columns: number('Squares across', 8.5, 5, 14, 'Layout', 0.5),
  cellAspect: number('Square height / width', 1.25, 0.8, 1.6, 'Layout', 0.05),
  shift: number('Grid offset left (squares)', 0.68, 0, 1, 'Layout', 0.01),
  top: number('Staircase starts (% of the height)', 14.8, 0, 40, 'Layout', 0.2),
  titleSize: number('Title size (square heights)', 1.12, 0.5, 1.6, 'Layout', 0.01),
  bodySize: number('Text size (% of the width)', 1.62, 0.8, 3, 'Layout', 0.02),
  [VAR_PREFIX]: text('Runtime variable prefix', CHECKER_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function checkerComponent(): CustomComponent {
  return {
    source: { html: '', css: CHECKER_CSS.trim(), js: CHECKER_VIEW.trim() },
    propsSchema: { type: 'object', properties: CHECKER_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
