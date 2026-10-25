const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('benchMark', (name, what) => ipcRenderer.send('mark', name, what));
contextBridge.exposeInMainWorld('benchSystem', () => ipcRenderer.invoke('system'));
