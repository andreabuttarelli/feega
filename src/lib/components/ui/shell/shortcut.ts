export enum Platform {
  Mac = 'mac',
  Other = 'other'
}

const KEY_LABEL: Record<Platform, Record<string, string>> = {
  [Platform.Mac]: {
    Mod: '⌘',
    Ctrl: '⌃',
    Shift: '⇧',
    Alt: '⌥',
    Enter: '↵',
    Backspace: '⌫',
    Delete: '⌦',
    Escape: 'Esc',
    Tab: '⇥',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→'
  },
  [Platform.Other]: {
    Mod: 'Ctrl',
    Escape: 'Esc',
    Delete: 'Del',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→'
  }
};

const JOINER: Record<Platform, string> = {
  [Platform.Mac]: '',
  [Platform.Other]: '+'
};

export function shortcutKeys(shortcut: string, platform: Platform): string[] {
  return shortcut.split('+').map((key) => KEY_LABEL[platform][key] ?? (key.length === 1 ? key.toUpperCase() : key));
}

export function shortcutText(shortcut: string, platform: Platform): string {
  return shortcutKeys(shortcut, platform).join(JOINER[platform]);
}

export function currentPlatform(): Platform {
  if (typeof navigator === 'undefined') {
    return Platform.Mac;
  }
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? Platform.Mac : Platform.Other;
}
