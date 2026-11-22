import { Menu, type MenuItemConstructorOptions } from 'electron';
import { platformRow } from './platform';

export function installMenu(showSettings: () => void, checkUpdates: () => void) {
  const settings: MenuItemConstructorOptions = { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: showSettings };
  const updates: MenuItemConstructorOptions = { label: 'Check for Updates…', click: checkUpdates };
  const appMenu: MenuItemConstructorOptions = platformRow(process.platform).appMenu
    ? { label: 'Feega', submenu: [{ role: 'about' }, updates, { type: 'separator' }, settings, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }
    : { label: 'File', submenu: [settings, updates, { type: 'separator' }, { role: 'quit' }] };
  Menu.setApplicationMenu(Menu.buildFromTemplate([appMenu, { role: 'editMenu' }, { role: 'windowMenu' }]));
}
