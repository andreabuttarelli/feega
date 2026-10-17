export enum EntryShell {
  None = 'none',
  App = 'app',
  Canvas = 'canvas',
  Motion = 'motion'
}

const MOTION_EDITOR = /^\/p\/[^/]+\/c\/[^/]+\/motion\/[^/]+\/?$/;

function projectScope(pathname: string): string | null {
  return pathname.match(/^\/p\/([^/]+)/)?.[1] ?? null;
}

function inApp(pathname: string): boolean {
  return pathname.startsWith('/p/') || pathname === '/app' || pathname.startsWith('/app/');
}

function inDashboard(pathname: string): boolean {
  return pathname === '/app' || pathname.startsWith('/app/');
}

function isLogin(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/login/');
}

export function entryShell(nav: { from: string; to: string; signedIn: boolean }): EntryShell {
  if (isLogin(nav.to)) {
    return nav.signedIn ? EntryShell.App : EntryShell.None;
  }
  if (!inApp(nav.to) || (inDashboard(nav.from) && inDashboard(nav.to))) {
    return EntryShell.None;
  }

  const scope = projectScope(nav.to);
  if (scope && scope === projectScope(nav.from)) {
    return EntryShell.None;
  }
  if (MOTION_EDITOR.test(nav.to)) {
    return EntryShell.Motion;
  }

  return scope ? EntryShell.Canvas : EntryShell.App;
}
