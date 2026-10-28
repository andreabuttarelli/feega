export const RENDER_LINK_OPEN_MS = 30 * 60_000;
export const BROWSER_RENDER_DEADLINE_MS = 2 * 60 * 60_000;
export const RENDER_PAGE = '/render';
export const LINK_NEVER_OPENED = 'render link was never opened';

type LinkTrace = { link?: { expiresAt?: string; claim?: string | null } };

export function unopenedPast(params: LinkTrace, now: number): boolean {
  const link = params.link;
  if (!link?.expiresAt || link.claim) {
    return false;
  }
  return now > Date.parse(link.expiresAt);
}

export enum LinkRefusal {
  Invalid = 'invalid_link',
  Expired = 'link_expired',
  Used = 'link_used',
  Elsewhere = 'opened_elsewhere'
}

export const REFUSAL_TEXT: Record<LinkRefusal, string> = {
  [LinkRefusal.Invalid]: 'This render link is not valid.',
  [LinkRefusal.Expired]: 'This render link has expired. Ask for a new one.',
  [LinkRefusal.Used]: 'This render link was already used. The video is in your assets, or ask for a new link.',
  [LinkRefusal.Elsewhere]: 'This render link is already open on another device.'
};

export const renderPagePath = (token: string) => `${RENDER_PAGE}/${token}`;

export const AUTOSTART_PARAM = 'autostart';

export const headlessUrl = (renderUrl: string) => `${renderUrl}?${AUTOSTART_PARAM}=1`;

export const autostarts = (params: URLSearchParams) => params.get(AUTOSTART_PARAM) === '1';
