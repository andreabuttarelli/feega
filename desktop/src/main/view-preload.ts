import { contextBridge, ipcRenderer } from 'electron';
import type { Alert } from '../../../inspect/src/host/ai/agent-alert';
import { Channel } from './types';

contextBridge.exposeInMainWorld('feegaDesktop', {
  show: (alert: Alert): Promise<void> => ipcRenderer.invoke(Channel.Alert, alert),
  clear: (chat: string) => void ipcRenderer.invoke(Channel.AlertClear, chat),
  onOpen: (handle: (chat: string) => void) => void ipcRenderer.on(Channel.OpenChat, (_event, chat: string) => handle(chat))
});
