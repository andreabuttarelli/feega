import { contextBridge, ipcRenderer } from 'electron';
import { Channel, type Link, type Preferences, type ShellState } from './types';
import type { NewProjectAsk } from './project-creator';

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.dataset.platform = process.platform;
});

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
  setPreferences: (change: Partial<Preferences>) => call(Channel.SetPreferences, change),
  openLink: (link: Link) => call(Channel.OpenLink, link),
  overlay: (open: boolean) => call(Channel.Overlay, open),
  checkUpdates: () => call(Channel.CheckUpdates),
  installUpdate: () => call(Channel.InstallUpdate),
  quit: () => call(Channel.Quit),
  checkNode: () => call(Channel.CheckNode),
  pickParent: (): Promise<string | null> => call(Channel.PickParent),
  createProject: (ask: Omit<NewProjectAsk, 'parent'> & { parent: string }) => call(Channel.CreateProject, ask),
  clearProject: () => call(Channel.ClearProject),
  onSettings: (listener: () => void) => ipcRenderer.on(Channel.ShowSettings, () => listener()),
  onState: (listener: (state: ShellState) => void) => ipcRenderer.on(Channel.State, (_event, state) => listener(state))
});
