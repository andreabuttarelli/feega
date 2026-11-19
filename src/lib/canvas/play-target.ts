import { isDesktopShell } from '$lib/native-shell';
import { clampWidth } from '$lib/motion/prototype/viewport';

export enum PlayKind {
  Drawn = 'drawn',
  Live = 'live'
}

export enum PageHost {
  Iframe = 'iframe',
  Webview = 'webview'
}

export enum PageState {
  Running = 'running',
  Down = 'down'
}

export type LivePage = { id: string; name: string; route: string; width: number; poster: string | null };

export function playKindOf(id: string, drawn: ReadonlySet<string>, live: ReadonlySet<string>): PlayKind | null {
  const kinds: [PlayKind, ReadonlySet<string>][] = [
    [PlayKind.Live, live],
    [PlayKind.Drawn, drawn]
  ];
  return kinds.find(([, ids]) => ids.has(id))?.[0] ?? null;
}

export const pageHostOf = (userAgent: string | null) => (isDesktopShell(userAgent) ? PageHost.Webview : PageHost.Iframe);

export const pageStateOf = (origin: string | null) => (origin ? PageState.Running : PageState.Down);

export const playWidth = clampWidth;
