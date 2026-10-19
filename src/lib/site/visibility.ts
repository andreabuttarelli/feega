export enum SiteVisibility {
  Hidden = 'hidden',
  Shown = 'shown'
}

export type SiteEnv = { readonly vercelEnv?: string; readonly flag?: string };

const PRODUCTION = 'production';
const ENABLED = 'true';

export function siteVisibility(env: SiteEnv): SiteVisibility {
  if (env.flag === ENABLED || env.vercelEnv !== PRODUCTION) {
    return SiteVisibility.Shown;
  }

  return SiteVisibility.Hidden;
}
