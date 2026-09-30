export const CONSENT_VERSION = 2;
export const CONSENT_COOKIE = 'feega_consent';
export const CONSENT_MAX_AGE_S = 60 * 60 * 24 * 180;

export enum ConsentCategory {
  Necessary = 'necessary',
  Analytics = 'analytics',
  Marketing = 'marketing'
}

export enum Tracker {
  PostHog = 'posthog',
  Clarity = 'clarity',
  Seline = 'seline',
  SentryReplay = 'sentry-replay',
  MetaPixel = 'meta-pixel',
  GoogleTag = 'google-tag'
}

export const TRACKER_CATEGORY: Record<Tracker, ConsentCategory> = {
  [Tracker.PostHog]: ConsentCategory.Analytics,
  [Tracker.Clarity]: ConsentCategory.Analytics,
  [Tracker.Seline]: ConsentCategory.Analytics,
  [Tracker.SentryReplay]: ConsentCategory.Analytics,
  [Tracker.MetaPixel]: ConsentCategory.Marketing,
  [Tracker.GoogleTag]: ConsentCategory.Marketing
};

export type ConsentChoice = {
  version: number;
  at: number;
  analytics: boolean;
  marketing: boolean;
};

export type ConsentModeValue = 'granted' | 'denied';

export type ConsentModeState = {
  ad_storage: ConsentModeValue;
  ad_user_data: ConsentModeValue;
  ad_personalization: ConsentModeValue;
  analytics_storage: ConsentModeValue;
};

export function grants(choice: ConsentChoice | null, category: ConsentCategory): boolean {
  if (category === ConsentCategory.Necessary) {
    return true;
  }
  if (!choice) {
    return false;
  }
  return category === ConsentCategory.Analytics ? choice.analytics : choice.marketing;
}

export function allows(choice: ConsentChoice | null, tracker: Tracker): boolean {
  return grants(choice, TRACKER_CATEGORY[tracker]);
}

export function encodeConsent(choice: ConsentChoice): string {
  return encodeURIComponent(JSON.stringify(choice));
}

export function decodeConsent(raw: string | null | undefined): ConsentChoice | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentChoice>;
    if (parsed.version !== CONSENT_VERSION || typeof parsed.at !== 'number') {
      return null;
    }
    return {
      version: parsed.version,
      at: parsed.at,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true
    };
  } catch {
    return null;
  }
}

function modeValue(granted: boolean): ConsentModeValue {
  return granted ? 'granted' : 'denied';
}

export function consentModeState(choice: ConsentChoice | null): ConsentModeState {
  const marketing = modeValue(grants(choice, ConsentCategory.Marketing));
  return {
    ad_storage: marketing,
    ad_user_data: marketing,
    ad_personalization: marketing,
    analytics_storage: modeValue(grants(choice, ConsentCategory.Analytics))
  };
}

export function revokes(before: ConsentChoice | null, after: ConsentChoice): boolean {
  return (!!before?.analytics && !after.analytics) || (!!before?.marketing && !after.marketing);
}
