import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { WIRE_MODEL } from './model';
import { WIRE_VIEW } from './view';
import { WIRE_CSS } from './style';

export const WIRE_COMPONENT = 'WireGlobePages';
export const WIRE_VAR_PREFIX = 'wire';

const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const WIRE_PROPS: Record<string, PropSpec> = {
  media: { type: 'string', title: 'Pages (pictures and videos)', default: '', format: PropFormat.Media, maxLength: 2000, group: 'Content' },
  monochrome: flag('Black and white pages', true, 'Style'),
  background: colour('Background', '#0d0d0d'),
  lineColor: colour('Wire colour', '#bdbdbd'),
  emptyColor: colour('Empty page colour', '#2b2b2b'),
  contrast: number('Page contrast', 0.9, 0.4, 1.4, 'Style', 0.05),
  brightness: number('Page brightness', 0.72, 0.2, 1.2, 'Style', 0.02),
  lineOpacity: number('Wire strength', 0.55, 0, 1, 'Layout', 0.05),
  backLines: number('Wire behind the globe', 0.3, 0, 1, 'Layout', 0.05),
  gridStep: number('Wire spacing (degrees)', 15, 6, 45, 'Layout', 1),
  pages: number('Pages', 26, 6, 40, 'Layout', 1),
  pageSize: number('Page size', 1, 0.5, 1.6, 'Layout', 0.05),
  pageAspect: number('Page aspect (width / height)', 0.75, 0.4, 2, 'Layout', 0.05),
  radius: number('Globe radius (share of the short side)', 0.47, 0.2, 0.6, 'Layout', 0.01),
  backDim: number('Dim pages behind', 0.82, 0, 1, 'Camera', 0.05),
  axisTilt: number('Axis tilt (degrees)', 18, -45, 45, 'Camera', 1),
  sway: number('Axis sway (degrees)', 5, 0, 20, 'Camera', 0.5),
  turns: number('Rotation (turns per loop)', 1, 0, 4, 'Motion', 1),
  [VAR_PREFIX]: { type: 'string', title: 'Runtime variable prefix', default: WIRE_VAR_PREFIX, maxLength: 20, group: 'Layout' }
};

export function wireComponent(): CustomComponent {
  return {
    source: { html: '', css: WIRE_CSS.trim(), js: `${WIRE_MODEL.trim()}\n\n${WIRE_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: WIRE_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
