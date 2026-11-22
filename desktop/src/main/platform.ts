export enum GracefulStop {
  Signal = 'signal',
  Stdin = 'stdin'
}

export type Shortcuts = { settings: string; quit: string };

export type PlatformRow = {
  detached: boolean;
  windowsHide: boolean;
  graceful: GracefulStop;
  appMenu: boolean;
  shortcuts: Shortcuts;
  chrome: Record<string, unknown>;
};

export const TAB_BAR_HEIGHT = 52;
export const SOLID_BACKGROUND = '#121212';

const TRAFFIC_LIGHTS = { x: 18, y: 20 };
const TRANSPARENT = '#00000000';
const OVERLAY = { color: SOLID_BACKGROUND, symbolColor: '#ffffff', height: TAB_BAR_HEIGHT };

const overlayChrome = { titleBarStyle: 'hidden', titleBarOverlay: OVERLAY, autoHideMenuBar: true, backgroundColor: SOLID_BACKGROUND };

const DARWIN: PlatformRow = {
  detached: true,
  windowsHide: false,
  graceful: GracefulStop.Signal,
  appMenu: true,
  shortcuts: { settings: '⌘,', quit: '⌘Q' },
  chrome: { titleBarStyle: 'hiddenInset', trafficLightPosition: TRAFFIC_LIGHTS, vibrancy: 'under-window', visualEffectState: 'active', backgroundColor: TRANSPARENT }
};

const WIN32: PlatformRow = {
  detached: false,
  windowsHide: true,
  graceful: GracefulStop.Stdin,
  appMenu: false,
  shortcuts: { settings: 'Ctrl+,', quit: 'Ctrl+Q' },
  chrome: overlayChrome
};

const LINUX: PlatformRow = {
  detached: true,
  windowsHide: false,
  graceful: GracefulStop.Signal,
  appMenu: false,
  shortcuts: { settings: 'Ctrl+,', quit: 'Ctrl+Q' },
  chrome: overlayChrome
};

const ROWS: Partial<Record<string, PlatformRow>> = { darwin: DARWIN, win32: WIN32, linux: LINUX };

export const platformRow = (platform: string): PlatformRow => ROWS[platform] ?? LINUX;
