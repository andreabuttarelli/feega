import { describe, expect, it } from 'vitest';
import {
  CONSENT_VERSION,
  ConsentCategory,
  Tracker,
  TRACKER_CATEGORY,
  allows,
  consentModeState,
  decodeConsent,
  encodeConsent
} from './consent-model';

const AT = 1_750_000_000_000;

describe('ogni tracker ha una categoria, e nessuno è strettamente necessario', () => {
  it('la tabella copre ogni tracker', () => {
    for (const tracker of Object.values(Tracker)) {
      expect(TRACKER_CATEGORY[tracker]).toBeDefined();
      expect(TRACKER_CATEGORY[tracker]).not.toBe(ConsentCategory.Necessary);
    }
  });

  it('pubblicità e analisi stanno in categorie diverse', () => {
    expect(TRACKER_CATEGORY[Tracker.GoogleTag]).toBe(ConsentCategory.Marketing);
    expect(TRACKER_CATEGORY[Tracker.MetaPixel]).toBe(ConsentCategory.Marketing);
    expect(TRACKER_CATEGORY[Tracker.PostHog]).toBe(ConsentCategory.Analytics);
    expect(TRACKER_CATEGORY[Tracker.Clarity]).toBe(ConsentCategory.Analytics);
    expect(TRACKER_CATEGORY[Tracker.Seline]).toBe(ConsentCategory.Analytics);
    expect(TRACKER_CATEGORY[Tracker.SentryReplay]).toBe(ConsentCategory.Analytics);
  });
});

describe('senza una scelta non parte nulla', () => {
  it('nessun tracker è permesso senza consenso', () => {
    for (const tracker of Object.values(Tracker)) {
      expect(allows(null, tracker)).toBe(false);
    }
  });

  it('solo analisi accende solo i tracker di analisi', () => {
    const choice = { version: CONSENT_VERSION, at: AT, analytics: true, marketing: false };
    expect(allows(choice, Tracker.PostHog)).toBe(true);
    expect(allows(choice, Tracker.GoogleTag)).toBe(false);
    expect(allows(choice, Tracker.MetaPixel)).toBe(false);
  });
});

describe('il cookie di consenso porta versione e data', () => {
  it('andata e ritorno', () => {
    const choice = { version: CONSENT_VERSION, at: AT, analytics: true, marketing: false };
    expect(decodeConsent(encodeConsent(choice))).toEqual(choice);
  });

  it('una versione diversa della policy chiede di nuovo', () => {
    const old = { version: CONSENT_VERSION - 1, at: AT, analytics: true, marketing: true };
    expect(decodeConsent(encodeConsent(old))).toBeNull();
  });

  it('un valore illeggibile vale come nessuna scelta', () => {
    expect(decodeConsent(undefined)).toBeNull();
    expect(decodeConsent('granted')).toBeNull();
    expect(decodeConsent('%7Bbroken')).toBeNull();
  });
});

describe('Consent Mode v2 segue la scelta', () => {
  it('tutto negato di default', () => {
    expect(consentModeState(null)).toEqual({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied'
    });
  });

  it('marketing accende solo i segnali pubblicitari', () => {
    const choice = { version: CONSENT_VERSION, at: AT, analytics: false, marketing: true };
    expect(consentModeState(choice)).toEqual({
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'denied'
    });
  });
});
