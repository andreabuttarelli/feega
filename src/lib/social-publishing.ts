export const SOCIAL_PUBLISHING_FLAG = 'social_publishing';

export enum SocialPublishing {
  On = 'on',
  Off = 'off'
}

export const SOCIAL_PUBLISHING_SURFACE = {
  routes: [
    '/p/[projectId]/calendar',
    '/p/[projectId]/ads',
    '/p/[projectId]/posts',
    '/p/[projectId]/settings/connected-accounts',
    '/p/[projectId]/settings/connect',
    '/p/[projectId]/settings/facebook',
    '/p/[projectId]/settings/linkedin',
    '/(public)/docs/api/posts',
    '/api/v1/org/posts',
    '/api/v1/brands/[slug]/publishing',
    '/api/v1/brands/[slug]/social',
    '/api/v1/health/accounts/tick'
  ],
  actions: {
    '/p/[projectId]/c/[canvasId]': ['create_post', 'calendar_posts', 'plan_post', 'schedule_post'],
    '/app/studio/[batchId]': ['calendar']
  } as Record<string, readonly string[]>,
  navEntries: ['calendar', 'ads'],
  addable: ['calendar'],
  settingsSections: ['connected-accounts', 'facebook', 'linkedin', 'connect/[platform]'],
  promoteTabs: ['organic'],
  topBarActions: ['promote'],
  webTools: ['create_social_connect_link']
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

function actionOf(search: string): string | null {
  const match = /^\?\/([^&=]+)/.exec(search);
  return match ? match[1] : null;
}

export function routeRefused(publishing: SocialPublishing, routeId: string | null, search: string): boolean {
  if (publishing === SocialPublishing.On || !routeId) {
    return false;
  }
  if (SOCIAL_PUBLISHING_SURFACE.routes.some((prefix) => underRoute(routeId, prefix))) {
    return true;
  }
  const action = actionOf(search);
  return action !== null && (SOCIAL_PUBLISHING_SURFACE.actions[routeId] ?? []).includes(action);
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
