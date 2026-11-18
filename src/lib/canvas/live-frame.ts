export enum Breakpoint {
  Desktop = 'desktop',
  Tablet = 'tablet',
  Mobile = 'mobile'
}

export const LIVE_WIDTH: Record<Breakpoint, number> = {
  [Breakpoint.Desktop]: 1440,
  [Breakpoint.Tablet]: 768,
  [Breakpoint.Mobile]: 390
};

export const LIVE_HEIGHT = 900;

export type LiveFrame = { route: string; width: number; poster: string | null };

export const routeOf = (raw: string) => '/' + raw.trim().replace(/^[#/]+/, '');

export function liveFrameOf(data: Record<string, unknown> | undefined): LiveFrame | null {
  const live = data?.live as Partial<LiveFrame> | undefined;
  if (!live || typeof live.route !== 'string' || typeof live.width !== 'number') {
    return null;
  }

  return { route: live.route, width: live.width, poster: typeof live.poster === 'string' ? live.poster : null };
}

export function liveFrameData(route: string, breakpoint: Breakpoint): { live: LiveFrame } {
  return { live: { route: routeOf(route), width: LIVE_WIDTH[breakpoint], poster: null } };
}

export const liveUrl = (origin: string, route: string) => `${origin.replace(/\/+$/, '')}${routeOf(route)}`;

export function liveRoutes(rows: readonly { route?: unknown }[]): string[] {
  return [...new Set(rows.flatMap((r) => (typeof r.route === 'string' && r.route ? [r.route] : [])))];
}
