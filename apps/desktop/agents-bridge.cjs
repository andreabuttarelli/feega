const { contextBridge, ipcRenderer } = require('electron');

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
