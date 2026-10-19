import { NATIVE_AUTH_BASE } from '$lib/native-shell';

export enum BundleAuthPage {
  SignIn = '/auth/native',
  Callback = '/auth/native/callback',
  SignOut = '/auth/native/signout'
}

const SERVER_AUTH_PAGES: Record<string, BundleAuthPage> = {
  '/login': BundleAuthPage.SignIn,
  '/auth/callback': BundleAuthPage.Callback,
  '/auth/signout': BundleAuthPage.SignOut
};

export enum AuthMode {
  SignIn = 'signin',
  SignUp = 'signup'
}

export const NEXT_PARAM = 'next';
const HOME = '/app';
const IN_APP_PATH = /^\/(?!\/)/;

export function bundleAuthRoute(pathname: string): BundleAuthPage | null {
  return SERVER_AUTH_PAGES[pathname] ?? null;
}

export function oauthReturnUrl(next: string): string {
  return `${NATIVE_AUTH_BASE}/callback?${new URLSearchParams({ [NEXT_PARAM]: next })}`;
}

export function nextAfterSignIn(next: string | null): string {
  return next && IN_APP_PATH.test(next) ? next : HOME;
}
