import type { HostMessage, Source, ViewMessage } from '../messages';
import type { Catalog } from '../../../packages/library/src/catalog';
import type { AccountStore } from './account';
import type { CommentsCloud } from './comments';
import type { SharePort } from './share/share-port-factory';
import type { OnboardingStore } from './onboarding';
import type { PluginsHost } from './plugins-session';
import type { UsageHost } from './usage';
import type { SkillHintHost } from './skill-hint';
import type { SettingKey, SettingValue, Settings } from '../settings';

export enum Stored {
  Prefs = 'feegaInspect.prefs',
  History = 'feegaInspect.history',
  App = 'feegaInspect.app',
  ShareNotice = 'feegaInspect.shareNotice',
  Pids = 'feegaInspect.pids',
  SkillHint = 'feegaInspect.skillHint'
}

export type ChosenImage = { name: string; bytes: Uint8Array };

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
  copyText?: (text: string) => Promise<unknown>;
  revealSource?: (root: string, at: Source) => Promise<unknown>;
  showDiff: (path: string, before: string) => Promise<unknown>;
  confirm: (question: string, yes: string) => Promise<boolean>;
  chooseApp: (apps: string[], workspace: string) => Promise<string | null>;
  openExternal: (url: string) => unknown;
  openSettings: (key: SettingKey) => unknown;
  sourceControl: () => unknown;
  notify: (text: string) => unknown;
  warn: (text: string, action?: string) => Promise<boolean>;
  pickImage?: () => Promise<ChosenImage | null>;
  library?: () => Promise<Catalog | null>;
  usage?: UsageHost;
  account: AccountStore;
  cloud?: CommentsCloud;
  share?: SharePort;
  onboarding: OnboardingStore;
  plugins?: PluginsHost;
  skillHint?: SkillHintHost;
};
