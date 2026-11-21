export enum TabStatus {
  Starting = 'starting',
  Choosing = 'choosing',
  Ready = 'ready',
  Failed = 'failed'
}

export type AppOption = { label: string; app: string; framework: string };

export type TabInfo = { id: string; dir: string; name: string; status: TabStatus; message: string; log: string[]; url: string; apps: AppOption[] };

export type RecentInfo = { dir: string; name: string; framework: string; at: number };

export type Preferences = { editorPort: number; reopenOnLaunch: boolean; telemetry: boolean; automaticUpdates: boolean };

export enum UpdateState {
  Idle = 'idle',
  Checking = 'checking',
  Downloading = 'downloading',
  Ready = 'ready',
  UpToDate = 'up-to-date',
  Failed = 'failed'
}

export type UpdateInfo = { state: UpdateState; version: string; message: string };

export type ShellState = { tabs: TabInfo[]; active: string | null; email: string | null; signingIn: boolean; skipped: boolean; recents: RecentInfo[]; preferences: Preferences; update: UpdateInfo };

export enum Link {
  Account = 'account',
  Docs = 'docs',
  Community = 'community'
}

export enum Channel {
  State = 'state',
  GetState = 'get-state',
  SignIn = 'sign-in',
  CancelSignIn = 'cancel-sign-in',
  SignOut = 'sign-out',
  Skip = 'skip',
  PickFolder = 'pick-folder',
  OpenDir = 'open-dir',
  CloseTab = 'close-tab',
  RetryTab = 'retry-tab',
  ChooseApp = 'choose-app',
  Activate = 'activate',
  SetPreferences = 'set-preferences',
  OpenLink = 'open-link',
  Overlay = 'overlay',
  ShowSettings = 'show-settings',
  CheckUpdates = 'check-updates',
  InstallUpdate = 'install-update',
  Quit = 'quit'
}
