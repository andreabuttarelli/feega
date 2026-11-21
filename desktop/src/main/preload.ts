import { contextBridge, ipcRenderer } from 'electron';
import { Channel, type ShellState } from './types';

const call = (channel: Channel, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('feega', {
  state: (): Promise<ShellState> => call(Channel.GetState),
  signIn: () => call(Channel.SignIn),
  cancelSignIn: () => call(Channel.CancelSignIn),
  signOut: () => call(Channel.SignOut),
  skip: () => call(Channel.Skip),
  pickFolder: () => call(Channel.PickFolder),
  openDir: (dir: string) => call(Channel.OpenDir, dir),
  closeTab: (id: string) => call(Channel.CloseTab, id),
  chooseApp: (id: string, app: string) => call(Channel.ChooseApp, id, app),
  retryTab: (id: string) => call(Channel.RetryTab, id),
  activate: (id: string | null) => call(Channel.Activate, id),
  onState: (listener: (state: ShellState) => void) => ipcRenderer.on(Channel.State, (_event, state) => listener(state))
});
