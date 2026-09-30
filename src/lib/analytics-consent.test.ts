// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://oh.feega.app/"}
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_VERSION } from './consent-model';

vi.mock('$app/environment', () => ({ browser: true, dev: false }));
vi.mock('$env/dynamic/public', () => ({
  env: {
    PUBLIC_POSTHOG_KEY: 'phc_test',
    PUBLIC_META_PIXEL_ID: '123',
    PUBLIC_SELINE_TOKEN: 'sel',
    PUBLIC_GOOGLE_TAG_ID: 'AW-1'
  }
}));

const choice = (analytics: boolean, marketing: boolean) => ({
  version: CONSENT_VERSION,
  at: 1,
  analytics,
  marketing
});

function loadedSources(): string {
  const scripts = [...document.head.querySelectorAll('script')];
  return scripts.map((s) => `${s.src} ${s.textContent}`).join('\n');
}

async function fresh() {
  vi.resetModules();
  document.head.innerHTML = '';
  const mod = await import('./analytics');
  window.dispatchEvent(new Event('pointerdown'));
  return mod;
}

describe('nessun tracker parte senza la sua categoria', () => {
  beforeEach(() => {
    delete (window as { fbq?: unknown }).fbq;
    delete (window as { posthog?: unknown }).posthog;
  });

  it('senza consenso i loader non iniettano nulla', async () => {
    const { loadMetaPixel, loadSeline, identifyUser, loadGoogleTag } = await fresh();
    loadMetaPixel();
    loadSeline();
    loadGoogleTag();
    identifyUser('u1');
    window.dispatchEvent(new Event('pointerdown'));

    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });

  it('solo analisi carica PostHog e Seline, non Meta né Google', async () => {
    const { applyConsent } = await fresh();
    applyConsent(choice(true, false));
    window.dispatchEvent(new Event('pointerdown'));

    const loaded = loadedSources();
    expect(loaded).toContain('seline.js');
    expect(loaded).toContain('posthog');
    expect(loaded).not.toContain('fbevents');
    expect(loaded).not.toContain('googletagmanager');
  });

  it('solo marketing carica Meta e Google, non gli analytics', async () => {
    const { applyConsent } = await fresh();
    applyConsent(choice(false, true));
    window.dispatchEvent(new Event('pointerdown'));

    const loaded = loadedSources();
    expect(loaded).toContain('fbevents');
    expect(loaded).toContain('googletagmanager.com/gtag/js?id=AW-1');
    expect(loaded).not.toContain('seline.js');
    expect(loaded).not.toContain('posthog');
  });

  it('il marketing aggiorna Consent Mode prima di caricare il tag', async () => {
    const { applyConsent } = await fresh();
    applyConsent(choice(false, true));

    const layer = (window as unknown as { dataLayer: IArguments[] }).dataLayer.map((a) => [...a]);
    expect(layer).toContainEqual([
      'consent',
      'update',
      { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'denied' }
    ]);
  });
});
