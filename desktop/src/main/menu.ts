import { Menu, type MenuItemConstructorOptions } from 'electron';
import { platformRow } from './platform';

export function installMenu(showSettings: () => void) {
  const settings: MenuItemConstructorOptions = { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: showSettings };
  const appMenu: MenuItemConstructorOptions = platformRow(process.platform).appMenu
    ? { label: 'Feega', submenu: [{ role: 'about' }, { type: 'separator' }, settings, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }
    : { label: 'File', submenu: [settings, { type: 'separator' }, { role: 'quit' }] };
  Menu.setApplicationMenu(Menu.buildFromTemplate([appMenu, { role: 'editMenu' }, { role: 'windowMenu' }]));
}
