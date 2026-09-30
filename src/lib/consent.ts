import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { applyConsent } from './analytics';
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_S,
  CONSENT_VERSION,
  decodeConsent,
  encodeConsent,
  revokes,
  type ConsentChoice
} from './consent-model';

export type ConsentCategories = Pick<ConsentChoice, 'analytics' | 'marketing'>;

export const consent = writable<ConsentChoice | null>(null);
export const showBanner = writable<boolean>(false);

function readCookie(): ConsentChoice | null {
  const prefix = `${CONSENT_COOKIE}=`;
  const entry = document.cookie
    .split('; ')
    .find((c) => c.startsWith(prefix));
  return decodeConsent(entry?.slice(prefix.length));
}

function writeCookie(choice: ConsentChoice) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${encodeConsent(choice)}; Path=/; Max-Age=${CONSENT_MAX_AGE_S}; SameSite=Lax${secure}`;
}

export function initConsent() {
  if (!browser) {
    return;
  }
  const choice = readCookie();
  consent.set(choice);
  if (!choice) {
    showBanner.set(true);
    return;
  }
  applyConsent(choice);
}

export function saveConsent(categories: ConsentCategories) {
  if (!browser) {
    return;
  }
  const before = readCookie();
  const choice: ConsentChoice = { version: CONSENT_VERSION, at: Date.now(), ...categories };
  writeCookie(choice);
  consent.set(choice);
  showBanner.set(false);
  if (revokes(before, choice)) {
    location.reload();
    return;
  }
  applyConsent(choice);
}

export function acceptAll() {
  saveConsent({ analytics: true, marketing: true });
}

export function rejectAll() {
  saveConsent({ analytics: false, marketing: false });
}

export function openCookieSettings() {
  showBanner.set(true);
}
