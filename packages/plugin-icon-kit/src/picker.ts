import type { PluginApi } from '@feega/plugin-api/client';
import { Control, OpKind, Place, frameworkOf, type ComponentFile, type Framework, type ProjectInfo, type Source, type UiNode } from '@feega/plugin-api/protocol';
import { OFFLINE_NOTE, iconFetcher, type Source } from './cdn';
import { search, type Searchable } from './search';

export const QUERY = 'query';
export const CHOSEN = 'icon';
export const RETRY = 'retry';
export const PAGE_SIZE = 60;

const PARALLEL_FETCHES = 6;
const REDRAW_EVERY = 12;

export type Values = Record<string, string | number | boolean>;

export type PickerIcon = Searchable;

export type PickerConfig<I extends PickerIcon> = {
  section: string;
  label: string;
  source: Source;
  load: () => Promise<I[]>;
  popular: string[];
  file: (icon: I, values: Values) => string;
  available?: (icon: I, values: Values) => boolean;
  initial: Values;
  options: (values: Values) => UiNode[];
  component: (icon: I, values: Values, info: ProjectInfo, framework: Framework, svg: string) => ComponentFile;
};

const NOT_A_COMPONENT = 'Add an icon to a Svelte, React, Vue or Astro file.';

type Opened = { target: Source; place: Place | null };

const sourceOf = (at: Source) => `${at.file}:${at.line}:${at.col}`;

export function iconPicker<I extends PickerIcon>(api: PluginApi, config: PickerConfig<I>) {
  const section = api.section(config.section);
  const icons = config.load();
  const fetcher = iconFetcher(api.fetch, config.source);
  const pending = new Set<string>();
  const failed = new Set<string>();
  let opened: Opened | null = null;
  let query = '';
  let values: Values = config.initial;

  async function matches(): Promise<I[]> {
    const all = (await icons).filter((icon) => config.available?.(icon, values) ?? true);
    if (query.trim()) {
      return search(all, query, all.length);
    }
    return config.popular.flatMap((name) => all.filter((icon) => icon.name === name));
  }

  const missing = (icon: I) => fetcher.cached(config.file(icon, values)) === undefined;

  async function build(): Promise<{ tree: UiNode[]; shown: I[] }> {
    const found = await matches();
    const shown = found.slice(0, PAGE_SIZE);
    const offline = shown.some((icon) => missing(icon) && failed.has(config.file(icon, values)));
    const note = offline ? OFFLINE_NOTE : !found.length ? `No icon matches "${query.trim()}".` : found.length > PAGE_SIZE ? `Showing ${PAGE_SIZE} of ${found.length}. Type to narrow.` : null;
    const retry: UiNode[] = offline ? [{ type: Control.Button, id: RETRY, label: 'Retry' }] : [];
    const items = shown.map((icon) => ({ id: icon.name, label: icon.name, image: fetcher.cached(config.file(icon, values)) }));

    return {
      shown,
      tree: [
        { type: Control.Search, id: QUERY, label: 'Search icons', value: query, placeholder: 'Search icons' },
        { type: Control.Grid, id: CHOSEN, label: 'Icons', selected: null, items },
        ...(note ? [{ type: Control.Note as const, text: note }] : []),
        ...retry,
        ...config.options(values)
      ]
    };
  }

  async function load(wanted: I[]) {
    const queue = [...wanted];
    let done = 0;
    const worker = async () => {
      for (let icon = queue.shift(); icon; icon = queue.shift()) {
        const path = config.file(icon, values);
        const svg = await fetcher.get(path);
        pending.delete(path);
        if (svg === null) {
          failed.add(path);
        }
        if (++done % REDRAW_EVERY === 0) {
          void show(false);
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL_FETCHES }, worker));
    await show(false);
  }

  async function show(fetching = true) {
    if (!opened) {
      await section.render([]);
      return;
    }
    const { tree, shown } = await build();
    await section.render(tree);
    const wanted = shown.filter((icon) => {
      const path = config.file(icon, values);
      return fetching && missing(icon) && !pending.has(path) && !failed.has(path);
    });
    wanted.forEach((icon) => pending.add(config.file(icon, values)));
    if (wanted.length) {
      void load(wanted);
    }
  }

  async function insert(name: string) {
    const at = opened;
    opened = null;
    await show();
    const framework = at ? frameworkOf(at.target.file) : null;
    if (!at) {
      return;
    }
    if (!framework) {
      await api.notify(NOT_A_COMPONENT);
      return;
    }
    const icon = (await icons).find((one) => one.name === name) as I;
    const svg = await fetcher.get(config.file(icon, values));
    if (svg === null) {
      await api.notify(OFFLINE_NOTE);
      return;
    }
    const component = config.component(icon, values, await api.project.info(), framework, svg);

    await api.propose(config.label, [{ kind: OpKind.Insert, at: sourceOf(at.target), place: at.place ?? Place.Auto, component }]);
  }

  const retry = () => (failed.clear(), show());

  const change = (apply: () => void) => {
    apply();
    failed.clear();
    return show();
  };

  const ACTIONS: Record<string, (value: string | number | boolean) => Promise<void>> = {
    [QUERY]: (value) => change(() => (query = String(value))),
    [CHOSEN]: (value) => insert(String(value)),
    [RETRY]: retry
  };

  section.on((id, value) => void (ACTIONS[id] ?? ((next) => change(() => (values = { ...values, [id]: next }))))(value));

  api.menu.on((_, target, place) => {
    if (target) {
      opened = { target, place };
      void show();
    }
  });
}
