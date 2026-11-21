export enum TabStatus {
  Starting = 'starting',
  Ready = 'ready',
  Failed = 'failed'
}

export type TabInfo = { id: string; dir: string; name: string; status: TabStatus; message: string };

export type ShellState = { tabs: TabInfo[]; active: string | null; email: string | null; skipped: boolean; recents: string[] };

export enum Channel {
  State = 'state',
  GetState = 'get-state',
  SignIn = 'sign-in',
  SignOut = 'sign-out',
  Skip = 'skip',
  PickFolder = 'pick-folder',
  OpenDir = 'open-dir',
  CloseTab = 'close-tab',
  Activate = 'activate'
}
