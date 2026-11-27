import type { PluginApi } from '@feega/plugin-api/client';
import { Control, type UiNode } from '@feega/plugin-api/protocol';
import { envOf } from '@feega/plugin-icon-kit/env';
import { CHOSEN, INSERT, QUERY, iconPicker, type PickerConfig, type Values } from '@feega/plugin-icon-kit/picker';
import { attributesOf, componentName, svgComponent, type Prop, type SvgSpec } from '@feega/plugin-icon-kit/svg-component';
import { CURRENT_COLOUR, DEFAULT_SIZE, LOOKS, OUTLINE_STROKE, POPULAR, STYLES, Style, bodyOf, glyphOf, hasStyle, loadIcons, type Hero } from './icons';
import { libraryFor } from './library';

export { CHOSEN, INSERT, QUERY };
export const SECTION = 'heroicons';
export const STYLE = 'style';
export const SIZE = 'size';
export const INHERIT = 'inherit';
export const COLOUR = 'colour';
export const LABEL = 'Heroicon';

const DEFAULT_COLOUR = '#000000';
const MIN_SIZE = 8;
const MAX_SIZE = 128;

const INLINE_PROPS: Prop[] = [
  { name: 'size', fallback: DEFAULT_SIZE },
  { name: 'color', fallback: CURRENT_COLOUR }
];

const LIBRARY_PROPS: Prop[] = [
  { name: 'width', fallback: '' },
  { name: 'height', fallback: '' },
  { name: 'color', fallback: CURRENT_COLOUR }
];

const LABELS: Record<Style, string> = { [Style.Outline]: 'Outline 24', [Style.Solid]: 'Solid 24', [Style.Mini]: 'Mini 20', [Style.Micro]: 'Micro 16' };

const variantOf = (style: Style) => (style === Style.Outline ? '' : style);

const specOf = (icon: Hero, style: Style): SvgSpec => {
  const { grid, stroked } = LOOKS[style];

  return {
    name: componentName(icon.name, variantOf(style)),
    viewBox: `0 0 ${grid} ${grid}`,
    body: bodyOf(icon, style),
    fixed: stroked ? { fill: 'none', 'stroke-width': OUTLINE_STROKE, 'aria-hidden': 'true' } : { 'aria-hidden': 'true' },
    bound: stroked ? { width: 'size', height: 'size', stroke: 'color' } : { width: 'size', height: 'size', fill: 'color' },
    props: INLINE_PROPS
  };
};

const optionsOf = (values: Values): UiNode[] => [
  { type: Control.Select, id: STYLE, label: 'Style', value: String(values[STYLE]), options: STYLES.map((style) => ({ value: style, label: LABELS[style] })) },
  { type: Control.Slider, id: SIZE, label: 'Size', min: MIN_SIZE, max: MAX_SIZE, step: 1, value: Number(values[SIZE]) },
  { type: Control.Toggle, id: INHERIT, label: 'Text colour', value: Boolean(values[INHERIT]) },
  ...(values[INHERIT] ? [] : [{ type: Control.Colour as const, id: COLOUR, label: 'Colour', value: String(values[COLOUR]) }])
];

const CONFIG: PickerConfig<Hero> = {
  section: SECTION,
  label: LABEL,
  load: loadIcons,
  popular: POPULAR,
  glyph: (icon, values) => glyphOf(icon, values[STYLE] as Style),
  available: (icon, values) => hasStyle(icon, values[STYLE] as Style),
  initial: { [STYLE]: Style.Outline, [SIZE]: DEFAULT_SIZE, [INHERIT]: true, [COLOUR]: DEFAULT_COLOUR },
  options: optionsOf,
  component: (icon, values, info, framework) => {
    const env = envOf(info);
    const style = values[STYLE] as Style;
    const name = componentName(icon.name, variantOf(style));
    const color = values[INHERIT] ? CURRENT_COLOUR : String(values[COLOUR]);
    const size = Number(values[SIZE]);
    const library = libraryFor(framework, info.packages, style);
    if (library) {
      const file = library.wrap(icon.name, name, env);
      return { name, file: file.file, source: file.source, attributes: attributesOf(framework, LIBRARY_PROPS, { width: size, height: size, color }) };
    }
    const file = svgComponent(specOf(icon, style), framework, env);

    return { name, file: file.file, source: file.source, attributes: attributesOf(framework, INLINE_PROPS, { size, color }) };
  }
};

export const heroiconsPlugin = (api: PluginApi) => iconPicker(api, CONFIG);
