import type { PluginApi } from '@feega/plugin-api/client';
import { Control, type UiNode } from '@feega/plugin-api/protocol';
import { envOf } from '@feega/plugin-icon-kit/env';
import { CHOSEN, INSERT, QUERY, iconPicker, type PickerConfig, type Values } from '@feega/plugin-icon-kit/picker';
import { attributesOf, componentName, svgComponent, type Prop, type SvgSpec } from '@feega/plugin-icon-kit/svg-component';
import { CURRENT_COLOUR, DEFAULT_SIZE, POPULAR, VIEW_BOX, bodyOf, glyphOf, loadLogos, type Logo } from './icons';

export { CHOSEN, INSERT, QUERY };
export const SECTION = 'logos';
export const SIZE = 'size';
export const BRAND = 'brand';
export const LABEL = 'Brand logo';

enum Colour {
  Brand = 'brand',
  Current = 'current'
}

const MIN_SIZE = 8;
const MAX_SIZE = 128;
const TRADEMARK_NOTE = 'Logos are trademarks of their owners. Brand guidelines apply to how you use them.';

const PROPS: Prop[] = [
  { name: 'size', fallback: DEFAULT_SIZE },
  { name: 'color', fallback: CURRENT_COLOUR }
];

const specOf = (logo: Logo): SvgSpec => ({
  name: componentName(logo.name),
  viewBox: VIEW_BOX,
  body: bodyOf(logo),
  fixed: { role: 'img' },
  bound: { width: 'size', height: 'size', fill: 'color' },
  props: PROPS
});

const optionsOf = (values: Values): UiNode[] => [
  { type: Control.Slider, id: SIZE, label: 'Size', min: MIN_SIZE, max: MAX_SIZE, step: 1, value: Number(values[SIZE]) },
  {
    type: Control.Select,
    id: BRAND,
    label: 'Colour',
    value: String(values[BRAND]),
    options: [
      { value: Colour.Brand, label: 'Brand colour' },
      { value: Colour.Current, label: 'Text colour' }
    ]
  },
  { type: Control.Note, text: TRADEMARK_NOTE }
];

const CONFIG: PickerConfig<Logo> = {
  section: SECTION,
  label: LABEL,
  load: loadLogos,
  popular: POPULAR,
  glyph: glyphOf,
  initial: { [SIZE]: DEFAULT_SIZE, [BRAND]: Colour.Brand },
  options: optionsOf,
  component: (logo, values, info, framework) => {
    const file = svgComponent(specOf(logo), framework, envOf(info));
    const color = values[BRAND] === Colour.Brand ? `#${logo.hex}` : CURRENT_COLOUR;

    return { name: componentName(logo.name), file: file.file, source: file.source, attributes: attributesOf(framework, PROPS, { size: Number(values[SIZE]), color }) };
  }
};

export const brandLogosPlugin = (api: PluginApi) => iconPicker(api, CONFIG);
