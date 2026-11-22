import { createPluginHost } from '@feega/plugin-api/host';
import { parseManifest, Point } from '@feega/plugin-api/manifest';
import type { Source } from '@feega/plugin-api/protocol';
import type { HostMessage, Pick } from '../messages';
import { BUILT_IN } from './builtin-plugins';
import { pickFile } from './file-pick';
import { holds } from '@feega/plugin-api/when';
import { editorPort, hostCalls, selectionOf } from './plugin-editor';
import { workerSandbox } from './worker-sandbox';

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

  for (const { manifest } of BUILT_IN) {
    const parsed = parseManifest(manifest);
    const loaded = parsed.ok ? host.load(parsed.manifest, '') : parsed;
    if (!loaded.ok) {
      deps.notify(`Plugin not loaded: ${loaded.reason}`);
    }
  }

  const at = (point: Point) => {
    const pick = deps.pick();
    const selection = pick ? selectionOf(pick) : null;
    return (version, host.contributions(point).filter((one) => holds(one.entry.when, selection)));
  };

  return {
    host,
    answer: calls.answer,
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
