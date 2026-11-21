import { WebContentsView, type BrowserWindow } from 'electron';
import { basename } from 'node:path';
import { startCli } from './cli-process';
import { TabStatus, type TabInfo } from './types';

export const CHROME_HEIGHT = 44;

type Tab = { info: TabInfo; view: WebContentsView; stop: () => Promise<void> };

export function tabHost(window: BrowserWindow, changed: () => void) {
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
    changed();
  };

  window.on('resize', layout);

  const close = async (id: string) => {
    const tab = tabs.get(id);
    if (!tab) {
      return;
    }
    tabs.delete(id);
    window.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
    if (active === id) {
      active = [...tabs.keys()].at(-1) ?? null;
    }
    layout();
    changed();
    await tab.stop();
  };

  const open = async (dir: string) => {
    const id = `tab-${++next}`;
    const view = new WebContentsView();
    const info: TabInfo = { id, dir, name: basename(dir), status: TabStatus.Starting, message: 'starting dev server' };
    tabs.set(id, { info, view, stop: async () => undefined });
    window.contentView.addChildView(view);
    active = id;
    layout();
    changed();

    const cli = await startCli(dir, {
      onLine: (line) => patch(id, { message: line.replace(/^feega:\s*/, '') }),
      onUrl: (url) => {
        patch(id, { status: TabStatus.Ready });
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
    closeAll: () => Promise.all([...tabs.keys()].map(close)),
    view: (id: string) => tabs.get(id)?.view
  };
}
