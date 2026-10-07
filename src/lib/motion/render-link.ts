export const RENDER_LINK_OPEN_MS = 30 * 60_000;
export const BROWSER_RENDER_DEADLINE_MS = 2 * 60 * 60_000;
export const RENDER_PAGE = '/render';

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
