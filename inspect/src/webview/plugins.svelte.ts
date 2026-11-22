import type { Catalog } from '@feega/plugin-api/external';
import { createPluginHost } from '@feega/plugin-api/host';
import { parseManifest, Point, type Manifest } from '@feega/plugin-api/manifest';
import type { Source } from '@feega/plugin-api/protocol';
import type { HostMessage, Pick } from '../messages';
import { BUILT_IN } from './builtin-plugins';
import { pickFile } from './file-pick';
import { holds } from '@feega/plugin-api/when';
import { editorPort, hostCalls, selectionOf } from './plugin-editor';
import { rowsOf } from './plugin-manager';
import { reconcile, wantedOf } from './plugin-sync';
import { workerSandbox } from './worker-sandbox';

const NO_EXTERNAL: Catalog = { plugins: [], disabled: [], problems: [] };

export type PluginDeps = {
  pick: () => Pick | null;
  preview: (source: Source, css: Record<string, string> | null) => void;
  notify: (text: string) => void;
  send: (message: HostMessage) => void;
};

export function createPlugins(deps: PluginDeps) {
  let version = $state(0);
  const calls = hostCalls(deps.send);
  const workers = Object.fromEntries(BUILT_IN.map(({ manifest, worker }) => [(manifest as { id: string }).id, worker]));
  const host = createPluginHost({ sandbox: workerSandbox(workers), editor: editorPort({ pick: deps.pick, calls, preview: deps.preview, notify: deps.notify, pickFile }) });
  host.subscribe(() => version++);

  const builtIn = BUILT_IN.flatMap(({ manifest }) => {
    const parsed = parseManifest(manifest);
    return parsed.ok ? [parsed.manifest] : [];
  });
  const loaded = new Map<string, string>();
  let catalog = $state<Catalog>(NO_EXTERNAL);
  let canInstall = $state(false);

  function sync(next: Catalog) {
    catalog = next;
    const { unload, load } = reconcile(loaded, wantedOf(builtIn, next));
    for (const id of unload) {
      host.unload(id);
      loaded.delete(id);
    }
    for (const one of load) {
      const out = host.load(one.manifest as Manifest, one.code);
      if (out.ok) {
        loaded.set(one.id, one.stamp);
        continue;
      }
      deps.notify(`Plugin not loaded: ${out.reason}`);
    }
  }

  sync(NO_EXTERNAL);

  const at = (point: Point) => {
    const pick = deps.pick();
    const selection = pick ? selectionOf(pick) : null;
    return (version, host.contributions(point).filter((one) => holds(one.entry.when, selection)));
  };

  return {
    host,
    answer: calls.answer,
    sync: (next: Catalog, installable: boolean) => ((canInstall = installable), sync(next)),
    get rows() {
      return rowsOf(builtIn, catalog);
    },
    get problems() {
      return catalog.problems;
    },
    get canInstall() {
      return canInstall;
    },
    get rightBar() {
      return at(Point.RightBar);
    },
    get topBar() {
      return at(Point.TopBar);
    },
    get addMenu() {
      return at(Point.AddMenu);
    },
    get contextMenu() {
      return at(Point.ContextMenu);
    },
    get sidePanel() {
      return at(Point.SidePanel);
    },
    get commands() {
      return at(Point.Command);
    },
    get overlays() {
      return at(Point.Overlay);
    },
    ui: (plugin: string, id: string) => (version, host.ui(plugin, id)),
    handles: (plugin: string, id: string) => (version, host.handles(plugin, id))
  };
}

export type Plugins = ReturnType<typeof createPlugins>;
