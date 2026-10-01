import { campaignOf, type Campaign } from '$lib/onboarding/campaigns';

export const CAMPAIGN_COOKIE = 'feega_campaign';

const CAMPAIGN_PARAM = 'utm_campaign';
const CAMPAIGN_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 7;
const COOKIE_PATH = '/';

type CookieJar = {
  get: (name: string) => string | undefined;
  set: (name: string, value: string, opts: { path: string; maxAge: number; httpOnly: boolean; sameSite: 'lax'; secure: boolean }) => void;
  delete: (name: string, opts: { path: string }) => void;
};

export function rememberCampaign(cookies: CookieJar, url: URL): void {
  const campaign = campaignOf(url.searchParams.get(CAMPAIGN_PARAM));
  if (!campaign) {
    return;
  }

  cookies.set(CAMPAIGN_COOKIE, campaign, {
    path: COOKIE_PATH,
    maxAge: CAMPAIGN_COOKIE_MAX_AGE_S,
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:'
  });
}

export function takeCampaign(cookies: Pick<CookieJar, 'get' | 'delete'>): Campaign | null {
  const stored = cookies.get(CAMPAIGN_COOKIE);
  if (stored === undefined) {
    return null;
  }

  cookies.delete(CAMPAIGN_COOKIE, { path: COOKIE_PATH });
  return campaignOf(stored);
}
