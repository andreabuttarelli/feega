import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { FLOW_MODEL } from './model';
import { FLOW_VIEW } from './view';
import { FLOW_CSS } from './style';

export const FLOW_COMPONENT = 'FlowLines';
export const FLOW_VAR_PREFIX = 'flow';

export const FLOW_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const FLOW_PROPS: Record<string, PropSpec> = {
  title: text('Title (empty: lines only)', 'go with the flow', { maxLength: 60 }),
  lowercase: flag('Lowercase title', true, 'Content'),
  lineColor: colour('Line colour', '#ffffff'),
  background: colour('Background', '#000000'),
  titleColor: colour('Title colour', '#ffffff'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  fontSize: number('Title size (% of the short side)', 11, 4, 24, 'Style', 0.5),
  fontWeight: number('Title weight', 600, 300, 800, 'Style', 100),
  tracking: number('Title tracking (em)', -0.04, -0.08, 0.05, 'Style', 0.005),
  density: number('Density', 0.6, 0, 1, 'Layout', 0.05),
  turbulence: number('Turbulence', 0.5, 0, 1, 'Layout', 0.05),
  size: number('Mass size (share of the short side)', 0.36, 0.2, 0.8, 'Layout', 0.01),
  speed: number('Flow speed (passes per loop)', 3, 0, 8, 'Motion', 1),
  titleAt: number('Title starts (seconds)', 5, 0, 8, 'Motion', 0.1),
  titleSeconds: number('Title holds (seconds)', 2.6, 1, 6, 'Motion', 0.1),
  titleDim: number('Dim the lines under the title', 0.75, 0, 1, 'Motion', 0.05),
  [VAR_PREFIX]: text('Runtime variable prefix', FLOW_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function flowComponent(): CustomComponent {
  return {
    source: { html: '', css: FLOW_CSS.trim(), js: `${FLOW_MODEL.trim()}\n\n${FLOW_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: FLOW_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
