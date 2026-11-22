export const DISMISSED_KEY = 'feega:ask-ai:dismissed';

const DISMISSED_VALUE = '1';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isDismissed(storage: ReadableStorage | null): boolean {
  try {
    return storage?.getItem(DISMISSED_KEY) === DISMISSED_VALUE;
  } catch {
    return false;
  }
}

export function dismiss(storage: WritableStorage | null): void {
  try {
    storage?.setItem(DISMISSED_KEY, DISMISSED_VALUE);
  } catch {
    return;
  }
}

export function inFrame(win: { self: unknown; top: unknown }): boolean {
  try {
    return win.self !== win.top;
  } catch {
    return true;
  }
}
