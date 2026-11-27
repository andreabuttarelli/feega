import type { PluginApi } from '@feega/plugin-api/client';
import { Control, type UiNode } from '@feega/plugin-api/protocol';
import { envOf } from '@feega/plugin-icon-kit/env';
import { CHOSEN, INSERT, PAGE_SIZE, QUERY, RETRY, iconPicker, type PickerConfig, type Values } from '@feega/plugin-icon-kit/picker';
import { innerOf } from '@feega/plugin-icon-kit/cdn';
import { attributesOf, componentName, svgComponent, type Prop, type SvgSpec } from '@feega/plugin-icon-kit/svg-component';
import { CURRENT_COLOUR, DEFAULT_SIZE, DEFAULT_STROKE, POPULAR, SOURCE, VIEW_BOX, fileOf, loadIcons, type LucideIcon } from './icons';
import { libraryFor } from './library';

export { CHOSEN, INSERT, PAGE_SIZE, QUERY, RETRY };
export const SECTION = 'icons';
export const SIZE = 'size';
export const STROKE = 'stroke';
export const INHERIT = 'inherit';
export const COLOUR = 'colour';
export const LABEL = 'Lucide icon';

const DEFAULT_COLOUR = '#000000';
const MIN_SIZE = 8;
const MAX_SIZE = 128;
const MIN_STROKE = 0.5;
const MAX_STROKE = 3;
const STROKE_STEP = 0.25;

const PROPS: Prop[] = [
  { name: 'size', fallback: DEFAULT_SIZE },
  { name: 'strokeWidth', fallback: DEFAULT_STROKE },
  { name: 'color', fallback: CURRENT_COLOUR }
];

const specOf = (icon: LucideIcon, svg: string): SvgSpec => ({
  name: componentName(icon.name),
  viewBox: VIEW_BOX,
  body: innerOf(svg),
  fixed: { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
  bound: { width: 'size', height: 'size', stroke: 'color', 'stroke-width': 'strokeWidth' },
  props: PROPS
});

const optionsOf = (values: Values): UiNode[] => [
  { type: Control.Slider, id: SIZE, label: 'Size', min: MIN_SIZE, max: MAX_SIZE, step: 1, value: Number(values[SIZE]) },
  { type: Control.Slider, id: STROKE, label: 'Stroke', min: MIN_STROKE, max: MAX_STROKE, step: STROKE_STEP, value: Number(values[STROKE]) },
  { type: Control.Toggle, id: INHERIT, label: 'Text colour', value: Boolean(values[INHERIT]) },
  ...(values[INHERIT] ? [] : [{ type: Control.Colour as const, id: COLOUR, label: 'Colour', value: String(values[COLOUR]) }])
];

const CONFIG: PickerConfig<LucideIcon> = {
  section: SECTION,
  label: LABEL,
  load: loadIcons,
  popular: POPULAR,
  source: SOURCE,
  file: fileOf,
  initial: { [SIZE]: DEFAULT_SIZE, [STROKE]: DEFAULT_STROKE, [INHERIT]: true, [COLOUR]: DEFAULT_COLOUR },
  options: optionsOf,
  component: (icon, values, info, framework, svg) => {
    const env = envOf(info);
    const name = componentName(icon.name);
    const library = libraryFor(framework, info.packages);
    const file = library ? library.wrap(icon.name, name, env) : svgComponent(specOf(icon, svg), framework, env);
    const attributes = attributesOf(framework, PROPS, { size: Number(values[SIZE]), strokeWidth: Number(values[STROKE]), color: values[INHERIT] ? CURRENT_COLOUR : String(values[COLOUR]) });

    return { name, file: file.file, source: file.source, attributes };
  }
};

export const lucidePlugin = (api: PluginApi) => iconPicker(api, CONFIG);
