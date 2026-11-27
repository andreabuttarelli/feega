import type { PluginApi } from '@feega/plugin-api/client';
import { Control, OpKind, Place, frameworkOf, type ComponentFile, type Framework, type ProjectInfo, type Selection, type UiNode } from '@feega/plugin-api/protocol';
import { search, type Searchable } from './search';

export const QUERY = 'query';
export const CHOSEN = 'icon';
export const INSERT = 'insert';
export const PAGE_SIZE = 60;

export type Values = Record<string, string | number | boolean>;

export type PickerIcon = Searchable;

export type PickerConfig<I extends PickerIcon> = {
  section: string;
  label: string;
  load: () => Promise<I[]>;
  popular: string[];
  glyph: (icon: I, values: Values) => string;
  initial: Values;
  options: (values: Values) => UiNode[];
  component: (icon: I, values: Values, info: ProjectInfo, framework: Framework) => ComponentFile;
};

const NOT_A_COMPONENT = 'Add an icon to a Svelte, React, Vue or Astro file.';

const sourceOf = (selection: Selection) => `${selection.source.file}:${selection.source.line}:${selection.source.col}`;

export function iconPicker<I extends PickerIcon>(api: PluginApi, config: PickerConfig<I>) {
  const section = api.section(config.section);
  const icons = config.load();
  let selection: Selection | null = null;
  let query = '';
  let chosen: string | null = null;
  let values: Values = config.initial;

  async function matches(): Promise<I[]> {
    const all = await icons;
    if (query.trim()) {
      return search(all, query, all.length);
    }
    return config.popular.flatMap((name) => all.filter((icon) => icon.name === name));
  }

  async function treeOf(): Promise<UiNode[]> {
    const found = await matches();
    const shown = found.slice(0, PAGE_SIZE);
    const note = !found.length ? `No icon matches "${query.trim()}".` : found.length > PAGE_SIZE ? `Showing ${PAGE_SIZE} of ${found.length}. Type to narrow.` : null;
    const insert: UiNode[] = chosen ? [{ type: Control.Button, id: INSERT, label: `Insert ${chosen}` }] : [];

    return [
      { type: Control.Search, id: QUERY, label: 'Search icons', value: query, placeholder: 'Search icons' },
      { type: Control.Grid, id: CHOSEN, label: 'Icons', selected: chosen, items: shown.map((icon) => ({ id: icon.name, label: icon.name, image: config.glyph(icon, values) })) },
      ...(note ? [{ type: Control.Note as const, text: note }] : []),
      ...config.options(values),
      ...insert
    ];
  }

  async function show() {
    await section.render(selection ? await treeOf() : []);
  }

  async function insert() {
    const framework = selection ? frameworkOf(selection.source.file) : null;
    if (!selection || !chosen) {
      return;
    }
    if (!framework) {
      await api.notify(NOT_A_COMPONENT);
      return;
    }
    const icon = (await icons).find((one) => one.name === chosen) as I;
    const component = config.component(icon, values, await api.project.info(), framework);

    await api.propose(config.label, [{ kind: OpKind.Insert, at: sourceOf(selection), place: Place.Auto, component }]);
  }

  const ACTIONS: Record<string, (value: string | number | boolean) => Promise<void>> = {
    [QUERY]: (value) => ((query = String(value)), show()),
    [CHOSEN]: (value) => ((chosen = String(value)), show()),
    [INSERT]: insert
  };

  section.on((id, value) => void (ACTIONS[id] ?? ((next) => ((values = { ...values, [id]: next }), show())))(value));

  api.selection.watch((next) => {
    selection = next;
    void show();
  });
}
