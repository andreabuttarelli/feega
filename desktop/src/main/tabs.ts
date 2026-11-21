import { WebContentsView, type BrowserWindow } from 'electron';
import { basename } from 'node:path';
import { chosenApp } from '../../../inspect/src/host/app-root';
import { diskTree } from './app-tree';
import { startCli } from './cli-process';
import { type PidFile } from './pid-file';
import { TabStatus, type AppOption, type TabInfo } from './types';

export const CHROME_HEIGHT = 44;
const MAX_LOG_LINES = 200;
const NO_APP = 'no web app (package.json) found in this folder';

type Tab = { info: TabInfo; view: WebContentsView; stop: () => Promise<void>; pick: ((app: string | null) => void) | null };

export function tabHost(window: BrowserWindow, changed: () => void, pids: PidFile) {
  const tabs = new Map<string, Tab>();
  let active: string | null = null;
  let next = 0;

  const layout = () => {
    const [width, height] = window.getContentSize();
    for (const [id, tab] of tabs) {
      tab.view.setVisible(id === active && tab.info.status === TabStatus.Ready);
      tab.view.setBounds({ x: 0, y: CHROME_HEIGHT, width, height: Math.max(0, height - CHROME_HEIGHT) });
    }
  };

  const patch = (id: string, change: Partial<TabInfo>) => {
    const tab = tabs.get(id);
    if (!tab) {
      return;
    }
    tab.info = { ...tab.info, ...change };
    layout();
    changed();
  };

  window.on('resize', layout);

  const close = async (id: string) => {
    const tab = tabs.get(id);
    if (!tab) {
      return;
    }
    tabs.delete(id);
    tab.pick?.(null);
    window.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
    if (active === id) {
      active = [...tabs.keys()].at(-1) ?? null;
    }
    layout();
    changed();
    await tab.stop();
  };

  const ask = (id: string, apps: AppOption[]) =>
    new Promise<string | null>((resolve) => {
      const tab = tabs.get(id);
      if (!tab) {
        resolve(null);
        return;
      }
      tab.pick = resolve;
      patch(id, { status: TabStatus.Choosing, apps });
    });

  const open = async (dir: string) => {
    const id = `tab-${++next}`;
    const view = new WebContentsView();
    const info: TabInfo = { id, dir, name: basename(dir), status: TabStatus.Starting, message: 'looking for the app', log: [], url: '', apps: [] };
    tabs.set(id, { info, view, stop: async () => undefined, pick: null });
    window.contentView.addChildView(view);
    active = id;
    layout();
    changed();

    const root = await chosenApp(dir, dir, diskTree, (apps) => ask(id, apps));
    if (!tabs.has(id)) {
      return;
    }
    if (!root) {
      patch(id, { status: TabStatus.Failed, message: NO_APP });
      return;
    }
    patch(id, { status: TabStatus.Starting, name: basename(root), message: 'starting dev server', apps: [] });

    const cli = await startCli(root, pids, {
      onLine: (line) => patch(id, { message: line.replace(/^feega:\s*/, ''), log: [...(tabs.get(id)?.info.log ?? []), line].slice(-MAX_LOG_LINES) }),
      onUrl: (url) => {
        patch(id, { status: TabStatus.Ready, url });
        void view.webContents.loadURL(url);
      },
      onExit: (tail) => {
        if (tabs.get(id)?.info.status === TabStatus.Starting) {
          patch(id, { status: TabStatus.Failed, message: tail || 'process exited' });
        }
      }
    }).catch((error: Error) => {
      patch(id, { status: TabStatus.Failed, message: error.message });
      return null;
    });

    const tab = tabs.get(id);
    if (tab && cli) {
      tab.stop = cli.stop;
      return;
    }
    await cli?.stop();
  };

  return {
    list: () => [...tabs.values()].map((t) => t.info),
    active: () => active,
    activate: (id: string | null) => {
      active = id !== null && tabs.has(id) ? id : null;
      layout();
      changed();
    },
    open,
    close,
    choose: (id: string, app: string) => tabs.get(id)?.pick?.(app),
    retry: async (id: string) => {
      const dir = tabs.get(id)?.info.dir;
      await close(id);
      if (dir) {
        await open(dir);
      }
    },
    closeAll: () => Promise.all([...tabs.keys()].map(close))
  };
}
