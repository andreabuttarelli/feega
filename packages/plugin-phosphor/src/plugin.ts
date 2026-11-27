import type { PluginApi } from '@feega/plugin-api/client';
import { Control, type UiNode } from '@feega/plugin-api/protocol';
import { envOf } from '@feega/plugin-icon-kit/env';
import { CHOSEN, INSERT, QUERY, iconPicker, type PickerConfig, type Values } from '@feega/plugin-icon-kit/picker';
import { attributesOf, componentName, svgComponent, type Prop, type SvgSpec } from '@feega/plugin-icon-kit/svg-component';
import { CURRENT_COLOUR, DEFAULT_SIZE, POPULAR, VIEW_BOX, WEIGHTS, Weight, bodyOf, glyphOf, loadIcons, type PhosphorIcon } from './icons';
import { libraryFor } from './library';

export { CHOSEN, INSERT, QUERY };
export const SECTION = 'phosphor';
export const WEIGHT = 'weight';
export const SIZE = 'size';
export const INHERIT = 'inherit';
export const COLOUR = 'colour';
export const LABEL = 'Phosphor icon';

const DEFAULT_COLOUR = '#000000';
const MIN_SIZE = 8;
const MAX_SIZE = 128;
const LIBRARY_DEFAULT_SIZE = '1em';

const INLINE_PROPS: Prop[] = [
  { name: 'size', fallback: DEFAULT_SIZE },
  { name: 'color', fallback: CURRENT_COLOUR }
];

const LIBRARY_PROPS: Prop[] = [
  { name: 'size', fallback: LIBRARY_DEFAULT_SIZE },
  { name: 'weight', fallback: Weight.Regular },
  { name: 'color', fallback: CURRENT_COLOUR }
];

const variantOf = (weight: Weight) => (weight === Weight.Regular ? '' : weight);

const specOf = (icon: PhosphorIcon, weight: Weight): SvgSpec => ({
  name: componentName(icon.name, variantOf(weight)),
  viewBox: VIEW_BOX,
  body: bodyOf(icon, weight),
  fixed: {},
  bound: { width: 'size', height: 'size', fill: 'color' },
  props: INLINE_PROPS
});

const optionsOf = (values: Values): UiNode[] => [
  { type: Control.Select, id: WEIGHT, label: 'Weight', value: String(values[WEIGHT]), options: WEIGHTS.map((weight) => ({ value: weight, label: weight[0].toUpperCase() + weight.slice(1) })) },
  { type: Control.Slider, id: SIZE, label: 'Size', min: MIN_SIZE, max: MAX_SIZE, step: 1, value: Number(values[SIZE]) },
  { type: Control.Toggle, id: INHERIT, label: 'Text colour', value: Boolean(values[INHERIT]) },
  ...(values[INHERIT] ? [] : [{ type: Control.Colour as const, id: COLOUR, label: 'Colour', value: String(values[COLOUR]) }])
];

const CONFIG: PickerConfig<PhosphorIcon> = {
  section: SECTION,
  label: LABEL,
  load: loadIcons,
  popular: POPULAR,
  glyph: (icon, values) => glyphOf(icon, values[WEIGHT] as Weight),
  initial: { [WEIGHT]: Weight.Regular, [SIZE]: DEFAULT_SIZE, [INHERIT]: true, [COLOUR]: DEFAULT_COLOUR },
  options: optionsOf,
  component: (icon, values, info, framework) => {
    const env = envOf(info);
    const weight = values[WEIGHT] as Weight;
    const color = values[INHERIT] ? CURRENT_COLOUR : String(values[COLOUR]);
    const size = Number(values[SIZE]);
    const library = libraryFor(framework, info.packages);
    if (library) {
      const name = componentName(icon.name);
      const file = library.wrap(icon.name, name, env);
      return { name, file: file.file, source: file.source, attributes: attributesOf(framework, LIBRARY_PROPS, { size, weight, color }) };
    }
    const file = svgComponent(specOf(icon, weight), framework, env);

    return { name: componentName(icon.name, variantOf(weight)), file: file.file, source: file.source, attributes: attributesOf(framework, INLINE_PROPS, { size, color }) };
  }
};

export const phosphorPlugin = (api: PluginApi) => iconPicker(api, CONFIG);
