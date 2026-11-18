const { contextBridge, ipcRenderer } = require('electron');

const PROTOCOL = 1;

const Channel = {
  Attach: 'native-canvas:attach',
  Send: 'native-canvas:send',
  Tick: 'native-canvas:tick',
  Place: 'native-canvas:place',
  Close: 'native-canvas:close',
  Stats: 'native-canvas:stats',
  Report: 'native-canvas:report',
  Available: 'native-canvas:available'
};

const AGENTS_PROTOCOL = 1;

const AgentChannel = {
  List: 'local-agents:list',
  Choose: 'local-agents:choose',
  Start: 'local-agents:start',
  Answer: 'local-agents:answer',
  Cancel: 'local-agents:cancel',
  Event: 'local-agents:event'
};

contextBridge.exposeInMainWorld('feegaLocalAgents', {
  protocol: AGENTS_PROTOCOL,
  list: (refresh) => ipcRenderer.invoke(AgentChannel.List, refresh),
  choose: (id) => ipcRenderer.invoke(AgentChannel.Choose, id),
  start: (turn) => ipcRenderer.invoke(AgentChannel.Start, turn),
  answer: (answer) => ipcRenderer.invoke(AgentChannel.Answer, answer),
  cancel: (turnId) => ipcRenderer.invoke(AgentChannel.Cancel, turnId),
  onEvent: (listener) => {
    const relay = (_event, turnId, body) => listener(turnId, body);
    ipcRenderer.on(AgentChannel.Event, relay);
    return () => ipcRenderer.removeListener(AgentChannel.Event, relay);
  }
});

let latest = '';

ipcRenderer.on(Channel.Report, (_event, message) => {
  latest = message;
});

const send = (method) => (...args) => ipcRenderer.send(Channel.Send, method, ...args);

const nativeCanvas = {
  protocol: PROTOCOL,
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
};

if (ipcRenderer.sendSync(Channel.Available)) {
  contextBridge.exposeInMainWorld('feegaNativeCanvas', nativeCanvas);
}
