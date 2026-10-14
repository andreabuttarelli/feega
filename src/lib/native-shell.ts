export const NATIVE_SHELL_MARK = 'FeegaNative/';
export const NATIVE_AUTH_BASE = 'feega://auth';

export function isNativeShell(userAgent: string | null): boolean {
  return (userAgent ?? '').includes(NATIVE_SHELL_MARK);
}
