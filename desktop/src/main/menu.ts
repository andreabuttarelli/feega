import { Menu, type MenuItemConstructorOptions } from 'electron';

export function installMenu(showSettings: () => void) {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Feega',
      submenu: [{ role: 'about' }, { type: 'separator' }, { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: showSettings }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }]
    },
    { role: 'editMenu' },
    { role: 'windowMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
