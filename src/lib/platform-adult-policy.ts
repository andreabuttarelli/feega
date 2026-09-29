import type { Platform } from './platform-capabilities';

export enum AdultPolicy {
  Forbidden = 'forbidden',
  NeedsConfirmation = 'needs_confirmation'
}

export const ADULT_CONTENT_POLICY: Readonly<Record<Platform, AdultPolicy>> = {
  instagram: AdultPolicy.Forbidden,
  facebook: AdultPolicy.Forbidden,
  threads: AdultPolicy.Forbidden,
  linkedin: AdultPolicy.Forbidden,
  tiktok: AdultPolicy.Forbidden,
  youtube: AdultPolicy.Forbidden,
  pinterest: AdultPolicy.Forbidden,
  x: AdultPolicy.NeedsConfirmation,
  reddit: AdultPolicy.NeedsConfirmation
};

export enum UncensoredConfirmation {
  Missing = 'missing',
  Given = 'given'
}

export function uncensoredDeliveryError(platform: Platform, confirmation: UncensoredConfirmation): string | null {
  const policy = ADULT_CONTENT_POLICY[platform] ?? AdultPolicy.Forbidden;
  if (policy === AdultPolicy.Forbidden) {
    return `adult_content_forbidden_on_${platform}`;
  }
  return confirmation === UncensoredConfirmation.Given ? null : 'uncensored_needs_confirmation';
}
