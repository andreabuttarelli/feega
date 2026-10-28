const { contextBridge, ipcRenderer } = require('electron');

const Channel = {
  Attach: 'native-canvas:attach',
  Send: 'native-canvas:send',
  Tick: 'native-canvas:tick',
  Place: 'native-canvas:place',
  Close: 'native-canvas:close',
  Stats: 'native-canvas:stats',
  Report: 'native-canvas:report'
};

let latest = '';

ipcRenderer.on(Channel.Report, (_event, message) => {
  latest = message;
});

const send = (method) => (...args) => ipcRenderer.send(Channel.Send, method, ...args);

contextBridge.exposeInMainWorld('feegaNativeCanvas', {
  attach: (placement, width, height, background) => {
    latest = '';
    return ipcRenderer.invoke(Channel.Attach, placement, width, height, background);
  },
  picture: (clip, rgba, width, height) => ipcRenderer.send(Channel.Send, 'picture', clip, new Uint8Array(rgba), width, height),
  putGroup: send('putGroup'),
  appendGroup: send('appendGroup'),
  patchGroup: send('patchGroup'),
  dropGroup: send('dropGroup'),
  patchUses: send('patchUses'),
  setOverlay: send('setOverlay'),
  snapshot: send('snapshot'),
  tick: (camera) => ipcRenderer.send(Channel.Tick, camera),
  place: (placement) => ipcRenderer.send(Channel.Place, placement),
  report: () => latest,
  stats: () => ipcRenderer.invoke(Channel.Stats),
  close: () => ipcRenderer.send(Channel.Close)
});
