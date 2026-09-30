import { CURRENT_TERMS_VERSION } from '$lib/legal-links';

export function outdatedTermsVersion(profileVersion: string | null): string | null {
  return profileVersion === CURRENT_TERMS_VERSION ? null : CURRENT_TERMS_VERSION;
}
