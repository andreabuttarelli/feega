import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { STEPS_MODEL } from './model';
import { STEPS_VIEW } from './view';
import { STEPS_CSS } from './style';

export const STEPS_COMPONENT = 'StepsList';
export const STEPS_VAR_PREFIX = 'steps';

export const STEPS_FONTS = ['Inter', 'Inter Tight', 'Geist', 'Instrument Sans', 'Manrope', 'DM Sans', 'Space Grotesk'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

const SAMPLE_DETAIL = 'Linen shirt on warm stone';

export const STEPS_PROPS: Record<string, PropSpec> = {
  heading: text('Heading', 'Building Image', { maxLength: 60 }),
  steps: text('Steps (one per line, "Label - detail")', `Processing - ${SAMPLE_DETAIL}\nGenerating - ${SAMPLE_DETAIL}\nImage - ${SAMPLE_DETAIL}`, { maxLength: 600 }),
  working: text('Status label', 'Working', { maxLength: 30 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  headingSize: number('Heading size (% of the short side)', 6.2, 2, 14, 'Style', 0.1),
  stepSize: number('Step size (% of the short side)', 4.6, 2, 10, 'Style', 0.1),
  background: colour('Background', '#e8e8e8'),
  ink: colour('Text colour', '#111111'),
  muted: colour('Detail colour', '#a9a9a9'),
  lineColor: colour('Line colour', '#7d7d7d'),
  accent1: colour('First icon colour', '#b24fd1'),
  accent2: colour('Second icon colour', '#5d8ad6'),
  accent3: colour('Third icon colour', '#e6b546'),
  delay: number('Start delay (seconds)', 0.4, 0, 4, 'Motion', 0.05),
  pace: number('Time between steps (seconds)', 1.6, 0.4, 4, 'Motion', 0.05),
  [VAR_PREFIX]: text('Runtime variable prefix', STEPS_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function stepsComponent(): CustomComponent {
  return {
    source: { html: '', css: STEPS_CSS.trim(), js: `${STEPS_MODEL.trim()}\n\n${STEPS_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: STEPS_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
