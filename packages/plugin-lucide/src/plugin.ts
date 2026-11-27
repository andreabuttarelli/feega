import type { PluginApi } from '@feega/plugin-api/client';
import { Control, OpKind, Place, frameworkOf, type Selection, type UiNode } from '@feega/plugin-api/protocol';
import { envOf } from '@feega/plugin-icon-kit/env';
import { search } from '@feega/plugin-icon-kit/search';
import { attributesOf, componentName, svgComponent, type Prop, type SvgSpec } from '@feega/plugin-icon-kit/svg-component';
import { CURRENT_COLOUR, DEFAULT_SIZE, DEFAULT_STROKE, POPULAR, VIEW_BOX, glyphOf, loadIcons, type LucideIcon } from './icons';
import { libraryFor } from './library';

export const SECTION = 'icons';
export const QUERY = 'query';
export const CHOSEN = 'icon';
export const SIZE = 'size';
export const STROKE = 'stroke';
export const INHERIT = 'inherit';
export const COLOUR = 'colour';
export const INSERT = 'insert';
export const LABEL = 'Lucide icon';
export const PAGE_SIZE = 60;

const NOT_A_COMPONENT = 'Add an icon to a Svelte, React, Vue or Astro file.';
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

const specOf = (icon: LucideIcon): SvgSpec => ({
  name: componentName(icon.name),
  viewBox: VIEW_BOX,
  body: icon.body,
  fixed: { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
  bound: { width: 'size', height: 'size', stroke: 'color', 'stroke-width': 'strokeWidth' },
  props: PROPS
});

const sourceOf = (selection: Selection) => `${selection.source.file}:${selection.source.line}:${selection.source.col}`;

type Options = { query: string; chosen: string | null; size: number; stroke: number; inherit: boolean; colour: string };

export function lucidePlugin(api: PluginApi) {
  const section = api.section(SECTION);
  const icons = loadIcons();
  let selection: Selection | null = null;
  let options: Options = { query: '', chosen: null, size: DEFAULT_SIZE, stroke: DEFAULT_STROKE, inherit: true, colour: DEFAULT_COLOUR };

  async function matches(): Promise<LucideIcon[]> {
    const all = await icons;
    const query = options.query.trim();
    if (query) {
      return search(all, query, all.length);
    }
    return POPULAR.flatMap((name) => all.filter((icon) => icon.name === name));
  }

  async function treeOf(): Promise<UiNode[]> {
    const found = await matches();
    const shown = found.slice(0, PAGE_SIZE);
    const note = !found.length ? `No icon matches "${options.query.trim()}".` : found.length > PAGE_SIZE ? `Showing ${PAGE_SIZE} of ${found.length}. Type to narrow.` : null;
    const colour: UiNode[] = options.inherit ? [] : [{ type: Control.Colour, id: COLOUR, label: 'Colour', value: options.colour }];
    const insert: UiNode[] = options.chosen ? [{ type: Control.Button, id: INSERT, label: `Insert ${options.chosen}` }] : [];

    return [
      { type: Control.Search, id: QUERY, label: 'Search icons', value: options.query, placeholder: 'Search icons' },
      { type: Control.Grid, id: CHOSEN, label: 'Icons', selected: options.chosen, items: shown.map((icon) => ({ id: icon.name, label: icon.name, image: glyphOf(icon) })) },
      ...(note ? [{ type: Control.Note as const, text: note }] : []),
      { type: Control.Slider, id: SIZE, label: 'Size', min: MIN_SIZE, max: MAX_SIZE, step: 1, value: options.size },
      { type: Control.Slider, id: STROKE, label: 'Stroke', min: MIN_STROKE, max: MAX_STROKE, step: STROKE_STEP, value: options.stroke },
      { type: Control.Toggle, id: INHERIT, label: 'Text colour', value: options.inherit },
      ...colour,
      ...insert
    ];
  }

  async function show() {
    await section.render(selection ? await treeOf() : []);
  }

  async function insert() {
    const framework = selection ? frameworkOf(selection.source.file) : null;
    if (!selection || !options.chosen) {
      return;
    }
    if (!framework) {
      await api.notify(NOT_A_COMPONENT);
      return;
    }
    const icon = (await icons).find((one) => one.name === options.chosen) as LucideIcon;
    const info = await api.project.info();
    const env = envOf(info);
    const name = componentName(icon.name);
    const library = libraryFor(framework, info.packages);
    const component = library ? library.wrap(icon.name, name, env) : svgComponent(specOf(icon), framework, env);
    const attributes = attributesOf(framework, PROPS, { size: options.size, strokeWidth: options.stroke, color: options.inherit ? CURRENT_COLOUR : options.colour });

    await api.propose(LABEL, [{ kind: OpKind.Insert, at: sourceOf(selection), place: Place.Auto, component: { name, file: component.file, source: component.source, attributes } }]);
  }

  const set = (next: Partial<Options>) => ((options = { ...options, ...next }), show());

  const ACTIONS: Record<string, (value: string | number | boolean) => Promise<void>> = {
    [QUERY]: (value) => set({ query: String(value) }),
    [CHOSEN]: (value) => set({ chosen: String(value) }),
    [SIZE]: (value) => set({ size: Number(value) }),
    [STROKE]: (value) => set({ stroke: Number(value) }),
    [INHERIT]: (value) => set({ inherit: Boolean(value) }),
    [COLOUR]: (value) => set({ colour: String(value) }),
    [INSERT]: insert
  };

  section.on((id, value) => void ACTIONS[id]?.(value));

  api.selection.watch((next) => {
    selection = next;
    void show();
  });
}
