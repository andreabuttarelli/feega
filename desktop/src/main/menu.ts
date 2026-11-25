import { Menu, type MenuItemConstructorOptions } from 'electron';
import { platformRow } from './platform';

export type MenuActions = { showSettings: () => void; checkUpdates: () => void; cloud: boolean; setCloud: (on: boolean) => void };

export function installMenu({ showSettings, checkUpdates, cloud, setCloud }: MenuActions) {
  const settings: MenuItemConstructorOptions = { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: showSettings };
  const updates: MenuItemConstructorOptions = { label: 'Check for Updates…', click: checkUpdates };
  const cloudItem: MenuItemConstructorOptions = { label: 'Feega Cloud (beta)', type: 'checkbox', checked: cloud, click: (item) => setCloud(item.checked) };
  const appMenu: MenuItemConstructorOptions = platformRow(process.platform).appMenu
    ? { label: 'Feega', submenu: [{ role: 'about' }, updates, { type: 'separator' }, settings, cloudItem, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }
    : { label: 'File', submenu: [settings, cloudItem, updates, { type: 'separator' }, { role: 'quit' }] };
  Menu.setApplicationMenu(Menu.buildFromTemplate([appMenu, { role: 'editMenu' }, { role: 'windowMenu' }]));
}
