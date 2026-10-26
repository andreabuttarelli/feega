import { isSiteHost } from './host';

export enum SiteVisibility {
  Hidden = 'hidden',
  Shown = 'shown'
}

export type SiteEnv = { readonly vercelEnv?: string; readonly flag?: string };

const PRODUCTION = 'production';
const ENABLED = 'true';

export function siteFlagOn(flag: string | undefined): boolean {
  return flag === ENABLED;
}

export function siteVisibility(env: SiteEnv): SiteVisibility {
  if (siteFlagOn(env.flag) || env.vercelEnv !== PRODUCTION) {
    return SiteVisibility.Shown;
  }

  return SiteVisibility.Hidden;
}

export function rootShowsSite(url: URL, env: SiteEnv): boolean {
  if (siteVisibility(env) === SiteVisibility.Hidden) {
    return false;
  }

  return isSiteHost(url) || env.vercelEnv !== PRODUCTION;
}
