import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_COOKIE, CONSENT_VERSION, decodeConsent } from './consent-model';

vi.mock('$app/environment', () => ({ browser: true }));

const applied: unknown[] = [];
vi.mock('./analytics', () => ({ applyConsent: (c: unknown) => applied.push(c) }));

let jar: string[] = [];
const reload = vi.fn();

function cookieValue(): string | undefined {
  const entry = jar.find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return entry?.split(';')[0].slice(CONSENT_COOKIE.length + 1);
}

beforeEach(() => {
  jar = [];
  applied.length = 0;
  reload.mockReset();
  vi.resetModules();
  (globalThis as Record<string, unknown>).document = {
    get cookie() {
      return jar.map((c) => c.split(';')[0]).join('; ');
    },
    set cookie(v: string) {
      const name = v.split('=')[0];
      jar = [...jar.filter((c) => !c.startsWith(`${name}=`)), v];
    }
  };
  (globalThis as Record<string, unknown>).location = { protocol: 'https:', reload };
});

describe('la scelta sta in un cookie di prima parte con versione e data', () => {
  it('rifiuta tutto scrive un cookie con entrambe le categorie negate', async () => {
    const { rejectAll } = await import('./consent');
    rejectAll();

    const choice = decodeConsent(cookieValue());
    expect(choice).toMatchObject({ version: CONSENT_VERSION, analytics: false, marketing: false });
    expect(typeof choice?.at).toBe('number');
    expect(jar[0]).toMatch(/Max-Age=\d+/);
    expect(jar[0]).toMatch(/SameSite=Lax/);
  });

  it('accetta tutto applica il consenso ai tracker', async () => {
    const { acceptAll } = await import('./consent');
    acceptAll();

    expect(applied).toHaveLength(1);
    expect(applied[0]).toMatchObject({ analytics: true, marketing: true });
  });

  it('una scelta di una versione precedente fa riapparire la banner', async () => {
    jar = [`${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify({ version: CONSENT_VERSION - 1, at: 1, analytics: true, marketing: true }))}`];
    const { initConsent, showBanner } = await import('./consent');
    initConsent();

    let shown = false;
    showBanner.subscribe((v) => (shown = v))();
    expect(shown).toBe(true);
    expect(applied).toHaveLength(0);
  });

  it('una scelta valida non chiede di nuovo e viene applicata', async () => {
    const { saveConsent, initConsent, showBanner } = await import('./consent');
    saveConsent({ analytics: true, marketing: false });
    applied.length = 0;
    initConsent();

    let shown = true;
    showBanner.subscribe((v) => (shown = v))();
    expect(shown).toBe(false);
    expect(applied[0]).toMatchObject({ analytics: true, marketing: false });
  });

  it('ritirare un consenso ricarica la pagina per spegnere i tracker già partiti', async () => {
    const { acceptAll, rejectAll } = await import('./consent');
    acceptAll();
    rejectAll();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
