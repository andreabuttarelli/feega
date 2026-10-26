import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_FEEGA_LOCAL: '1' } }));
vi.mock('$app/environment', () => ({ browser: true, dev: false }));

const { LocalOff, localOff } = await import('./local-user');
const { trackingAllowed } = await import('./analytics');

describe('in modalità locale niente tracciamento', () => {
  it('il banner dei cookie e gli analytics sono spenti', () => {
    expect(localOff(LocalOff.CookieBanner, { PUBLIC_FEEGA_LOCAL: '1' })).toBe(true);
    expect(localOff(LocalOff.Analytics, { PUBLIC_FEEGA_LOCAL: '1' })).toBe(true);
  });

  it('la chat è spenta in locale e accesa nel cloud', () => {
    expect(localOff(LocalOff.Chat, { PUBLIC_FEEGA_LOCAL: '1' })).toBe(true);
    expect(localOff(LocalOff.Chat, {})).toBe(false);
  });

  it('nel cloud restano accesi', () => {
    expect(localOff(LocalOff.CookieBanner, {})).toBe(false);
  });

  it('nessun tracker parte, nemmeno su un host di produzione', () => {
    expect(trackingAllowed('feega.app')).toBe(false);
  });
});

describe('in locale niente nodi che chiedono il cloud', () => {
  it('immagine, video e sorgenti online sono spenti, il testo resta', async () => {
    const { CLOUD_ADDABLE } = await import('./canvas/addable');

    expect(localOff(LocalOff.CloudNodes, { PUBLIC_FEEGA_LOCAL: '1' })).toBe(true);
    expect(CLOUD_ADDABLE.has('video')).toBe(true);
    expect(CLOUD_ADDABLE.has('text')).toBe(false);
  });
});
