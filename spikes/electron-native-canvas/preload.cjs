const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('nativeCanvas', {
  start: (r) => ipcRenderer.invoke('start', r),
  setCamera: (x, y, z) => ipcRenderer.send('camera', x, y, z),
  setMotion: (on) => ipcRenderer.send('motion', on),
  resize: (r) => ipcRenderer.send('resize', r),
  stats: () => ipcRenderer.sendSync('stats')
});
contextBridge.exposeInMainWorld('benchMark', (name, what) => ipcRenderer.send('mark', name, what));
contextBridge.exposeInMainWorld('benchSystem', () => ipcRenderer.invoke('system'));
