export const SOCIAL_PUBLISHING_FLAG = 'social_publishing';

export enum SocialPublishing {
  On = 'on',
  Off = 'off'
}

export const SOCIAL_PUBLISHING_SURFACE = {
  routes: [
    '/p/[projectId]/ads',
    '/p/[projectId]/promote',
    '/p/[projectId]/settings/connected-accounts',
    '/p/[projectId]/settings/connect',
    '/p/[projectId]/settings/facebook',
    '/p/[projectId]/settings/linkedin'
  ],
  navEntries: ['ads'],
  addable: ['calendar'],
  settingsSections: ['connected-accounts', 'facebook', 'linkedin', 'connect/[platform]'],
  topBarActions: ['promote']
} as const;

export function publishes(publishing: SocialPublishing | undefined): boolean {
  return publishing === SocialPublishing.On;
}

export function socialPublishingOf(enabled: boolean | null | undefined): SocialPublishing {
  return enabled === true ? SocialPublishing.On : SocialPublishing.Off;
}

function underRoute(routeId: string, prefix: string): boolean {
  return routeId === prefix || routeId.startsWith(`${prefix}/`);
}

export function routeRefused(publishing: SocialPublishing, routeId: string | null): boolean {
  if (publishing === SocialPublishing.On || !routeId) {
    return false;
  }
  return SOCIAL_PUBLISHING_SURFACE.routes.some((prefix) => underRoute(routeId, prefix));
}

export function visibleUnder<T>(publishing: SocialPublishing, hidden: readonly string[], items: readonly T[], key: (item: T) => string = String): T[] {
  if (publishing === SocialPublishing.On) {
    return [...items];
  }
  return items.filter((item) => !hidden.includes(key(item)));
}

export function shownUnder(publishing: SocialPublishing, hidden: readonly string[], id: string): boolean {
  return visibleUnder(publishing, hidden, [id]).length > 0;
}
