export const NATIVE_SHELL_MARK = 'FeegaNative/';
export const NATIVE_AUTH_BASE = 'feega://auth';

export function isNativeShell(userAgent: string | null): boolean {
  return (userAgent ?? '').includes(NATIVE_SHELL_MARK);
}

export const DESKTOP_SHELL_MARK = 'Electron/';

export function isDesktopShell(userAgent: string | null): boolean {
  return isNativeShell(userAgent) && (userAgent ?? '').includes(DESKTOP_SHELL_MARK);
}
