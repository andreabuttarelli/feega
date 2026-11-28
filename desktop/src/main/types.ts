import type { Settings } from '../../../inspect/src/settings';

export enum TabStatus {
  Starting = 'starting',
  Choosing = 'choosing',
  Ready = 'ready',
  Failed = 'failed'
}

export type AppOption = { label: string; app: string; framework: string };

export type ViewInfo = { id: string; title: string; closable: boolean };

export type TabInfo = { id: string; dir: string; name: string; status: TabStatus; message: string; log: string[]; url: string; apps: AppOption[]; views: ViewInfo[]; view: string };

export type RecentInfo = { dir: string; name: string; framework: string; at: number };

export type Preferences = { editorPort: number; reopenOnLaunch: boolean; automaticUpdates: boolean; cloud: boolean };

export enum UpdateState {
  Idle = 'idle',
  Checking = 'checking',
  Downloading = 'downloading',
  Available = 'available',
  Ready = 'ready',
  UpToDate = 'up-to-date',
  Failed = 'failed'
}

export type UpdateInfo = { state: UpdateState; version: string; message: string };

export enum NodeStatus {
  Checking = 'checking',
  Ready = 'ready',
  Problem = 'problem'
}

export type NodeState = { status: NodeStatus; message: string };

export type ProjectState = { name: string; step: string; line: string; error: string };

export type ShellState = { tabs: TabInfo[]; active: string | null; email: string | null; signingIn: boolean; skipped: boolean; recents: RecentInfo[]; preferences: Preferences; update: UpdateInfo; node: NodeState; project: ProjectState | null; invite: boolean; documents: string; onboarded: boolean; editor: Settings };

export enum Link {
  Account = 'account',
  Docs = 'docs',
  Community = 'community',
  Node = 'node'
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
  OpenSettings = 'open-settings',
  SetEditorSetting = 'set-editor-setting',
  CheckUpdates = 'check-updates',
  InstallUpdate = 'install-update',
  Quit = 'quit',
  CheckNode = 'check-node',
  PickParent = 'pick-parent',
  CreateProject = 'create-project',
  DismissInvite = 'dismiss-invite',
  ClearProject = 'clear-project',
  Alert = 'alert',
  AlertClear = 'alert-clear',
  OpenChat = 'open-chat',
  FinishOnboarding = 'finish-onboarding',
  ReplayOnboarding = 'replay-onboarding',
  OpenUrl = 'open-url',
  Copy = 'copy',
  DetectAgents = 'detect-agents',
  Views = 'views',
  ShowView = 'show-view',
  CloseView = 'close-view',
  PickView = 'pick-view',
  DropView = 'drop-view'
}
