import { contextBridge, ipcRenderer } from 'electron';
import type { Alert } from '../../../inspect/src/host/ai/agent-alert';
import { Channel } from './types';

contextBridge.exposeInMainWorld('feegaDesktop', {
  show: (alert: Alert): Promise<void> => ipcRenderer.invoke(Channel.Alert, alert),
  clear: (chat: string) => void ipcRenderer.invoke(Channel.AlertClear, chat),
  openSettings: () => void ipcRenderer.send(Channel.OpenSettings),
  views: (state: { tabs: { id: string; title: string; closable: boolean }[]; active: string }) => void ipcRenderer.send(Channel.Views, state),
  onShow: (handle: (id: string) => void) => void ipcRenderer.on(Channel.ShowView, (_event, id: string) => handle(id)),
  onClose: (handle: (id: string) => void) => void ipcRenderer.on(Channel.CloseView, (_event, id: string) => handle(id)),
  onOpen: (handle: (chat: string) => void) => void ipcRenderer.on(Channel.OpenChat, (_event, chat: string) => handle(chat))
});
