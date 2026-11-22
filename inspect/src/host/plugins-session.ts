import { catalogOf } from '@feega/plugin-store/catalog';
import { httpFetcher, type Fetcher } from '@feega/plugin-store/fetcher';
import { installPlugin, removePlugin } from '@feega/plugin-store/install';
import { readRegistry, setEnabled, writeRegistry } from '@feega/plugin-store/registry';
import { questionOf } from '@feega/plugin-store/review';
import { watchPlugins, type Watch } from '@feega/plugin-store/watch';
import { ToView, type ViewMessage } from '../messages';

const INSTALL_LABEL = 'Install';
const TERMINAL_INSTALL = 'Install it from the terminal: npx feega plugin add';

export type PluginsHost = { root: string; dev: () => string[]; approve?: (question: string, yes: string) => Promise<boolean> };

export type PluginsDeps = {
  host: PluginsHost;
  post: (message: ViewMessage) => unknown;
  notify: (text: string) => unknown;
  fetch?: Fetcher;
  watch?: Watch;
};

export function pluginsSession({ host, post, notify, fetch = httpFetcher(), watch }: PluginsDeps) {
  let stopWatching: (() => void) | null = null;

  async function show() {
    stopWatching ??= watchPlugins({ root: host.root, dev: host.dev(), onChange: () => void show(), watch });
    await post({ kind: ToView.Plugins, catalog: await catalogOf({ root: host.root, dev: host.dev() }), canInstall: host.approve !== undefined });
  }

  async function enable(id: string, enabled: boolean) {
    writeRegistry(host.root, setEnabled(readRegistry(host.root), id, enabled));
    await show();
  }

  async function remove(id: string) {
    const out = await removePlugin(host.root, id);
    if (!out.ok) {
      notify(out.reason);
    }
    await show();
  }

  async function install(source: string) {
    const { approve } = host;
    if (!approve) {
      notify(`${TERMINAL_INSTALL} ${source}`);
      return;
    }
    const out = await installPlugin({ root: host.root, fetch, approve: (review) => approve(questionOf(review), INSTALL_LABEL) }, source);
    notify(out.ok ? `Installed ${out.id} ${out.version}` : out.reason);
    await show();
  }

  function restart() {
    stopWatching?.();
    stopWatching = null;
    return show();
  }

  return { show, enable, remove, install, restart, stop: () => stopWatching?.() };
}

export type PluginsSession = ReturnType<typeof pluginsSession>;
