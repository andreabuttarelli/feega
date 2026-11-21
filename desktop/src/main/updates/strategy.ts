export enum Strategy {
  DarwinSwap = 'darwin-swap',
  ElectronUpdater = 'electron-updater',
  None = 'none'
}

export type UpdaterRow = { strategy: Strategy };

const ROWS: Partial<Record<string, UpdaterRow>> = {
  darwin: { strategy: Strategy.DarwinSwap },
  win32: { strategy: Strategy.ElectronUpdater },
  linux: { strategy: Strategy.ElectronUpdater }
};

export const updaterRow = (platform: string): UpdaterRow => ROWS[platform] ?? { strategy: Strategy.None };
