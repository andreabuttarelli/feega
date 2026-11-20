import type { HostMessage, Source, ViewMessage } from '../messages';
import type { AccountStore } from './account';
import type { SettingKey, SettingValue, Settings } from '../settings';

export enum Stored {
  Prefs = 'feegaInspect.prefs',
  History = 'feegaInspect.history',
  App = 'feegaInspect.app',
  Pids = 'feegaInspect.pids'
}

export type Transport = {
  send: (message: ViewMessage) => unknown;
  receive: (handle: (message: HostMessage) => unknown) => void;
};

export type Platform = Transport & {
  version: string;
  launcher: string;
  settings: () => Settings;
  setSetting: (key: SettingKey, value: SettingValue) => Promise<unknown>;
  stored: <T>(key: Stored) => T | undefined;
  store: (key: Stored, value: unknown) => Promise<unknown>;
  log: (line: string) => void;
  showLogs: () => unknown;
  openSource: (root: string, at: Source) => Promise<unknown>;
  showDiff: (path: string, before: string) => Promise<unknown>;
  confirm: (question: string, yes: string) => Promise<boolean>;
  chooseApp: (apps: string[], workspace: string) => Promise<string | null>;
  openExternal: (url: string) => unknown;
  openSettings: (key: SettingKey) => unknown;
  sourceControl: () => unknown;
  notify: (text: string) => unknown;
  account: AccountStore;
};
