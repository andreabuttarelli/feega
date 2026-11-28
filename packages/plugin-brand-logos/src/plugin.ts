import type { PluginApi } from '@feega/plugin-api/client';
import { Control, type UiNode } from '@feega/plugin-api/protocol';
import { envOf } from '@feega/plugin-icon-kit/env';
import { CHOSEN, QUERY, RETRY, iconPicker, type PickerConfig, type Values } from '@feega/plugin-icon-kit/picker';
import { innerOf } from '@feega/plugin-icon-kit/cdn';
import { attributesOf, componentName, svgComponent, type Prop, type SvgSpec } from '@feega/plugin-icon-kit/svg-component';
import { CURRENT_COLOUR, DEFAULT_SIZE, POPULAR, SOURCE, VIEW_BOX, fileOf, loadLogos, type Logo } from './icons';

export { CHOSEN, QUERY, RETRY };
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

const specOf = (logo: Logo, svg: string): SvgSpec => ({
  name: componentName(logo.name),
  viewBox: VIEW_BOX,
  body: innerOf(svg),
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
  source: SOURCE,
  file: fileOf,
  initial: { [SIZE]: DEFAULT_SIZE, [BRAND]: Colour.Brand },
  options: optionsOf,
  component: (logo, values, info, framework, svg) => {
    const file = svgComponent(specOf(logo, svg), framework, envOf(info));
    const color = values[BRAND] === Colour.Brand ? `#${logo.hex}` : CURRENT_COLOUR;

    return { name: componentName(logo.name), file: file.file, source: file.source, attributes: attributesOf(framework, PROPS, { size: Number(values[SIZE]), color }) };
  }
};

export const brandLogosPlugin = (api: PluginApi) => iconPicker(api, CONFIG);
