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

  it('la presentazione agli altri è spenta in locale e accesa nel cloud', () => {
    expect(localOff(LocalOff.Present, { PUBLIC_FEEGA_LOCAL: '1' })).toBe(true);
    expect(localOff(LocalOff.Present, {})).toBe(false);
  });

  it('nel cloud restano accesi', () => {
    expect(localOff(LocalOff.CookieBanner, {})).toBe(false);
  });

  it('nessun tracker parte, nemmeno su un host di produzione', () => {
    expect(trackingAllowed('feega.app')).toBe(false);
  });
});

describe('in locale i nodi AI tornano solo con una chiave', () => {
  it('senza chiave testo, immagine e video restano spenti', () => {
    expect(localOff(LocalOff.AiNodes, { PUBLIC_FEEGA_LOCAL: '1' })).toBe(true);
  });

  it('con una chiave tornano, le sorgenti cloud no', () => {
    const withKey = { PUBLIC_FEEGA_LOCAL: '1', PUBLIC_FEEGA_LOCAL_AI: '1' };

    expect(localOff(LocalOff.AiNodes, withKey)).toBe(false);
    expect(localOff(LocalOff.CloudNodes, withKey)).toBe(true);
  });

  it('nel cloud sono sempre accesi', () => {
    expect(localOff(LocalOff.AiNodes, {})).toBe(false);
  });
});

describe('in locale niente nodi che chiedono il cloud', () => {
  it('le sorgenti online sono spente, il documento resta', async () => {
    const { CLOUD_ADDABLE, AI_ADDABLE } = await import('./canvas/addable');

    expect(localOff(LocalOff.CloudNodes, { PUBLIC_FEEGA_LOCAL: '1' })).toBe(true);
    expect(AI_ADDABLE.has('video')).toBe(true);
    expect(CLOUD_ADDABLE.has('video')).toBe(false);
    expect(CLOUD_ADDABLE.has('products')).toBe(true);
    expect(CLOUD_ADDABLE.has('doc')).toBe(false);
  });

  it('ogni nodo che genera è spento senza una key, audio e 3D compresi', async () => {
    const { AI_ADDABLE } = await import('./canvas/addable');
    const { GEN_MEDIUMS } = await import('./canvas/gen-node');

    for (const medium of GEN_MEDIUMS) {
      expect(AI_ADDABLE.has(medium)).toBe(true);
    }
  });
});

describe('frame sources asked per mode', () => {
  it('local keeps two small asks open: one server thread, six browser connections shared with posters and fonts', async () => {
    const { sourceAsksFor } = await import('./local-user');
    expect(sourceAsksFor({ PUBLIC_FEEGA_LOCAL: '1' })).toEqual({ framesPerAsk: 2, open: 2 });
  });

  it('hosted asks wider, so separate instances parse in parallel', async () => {
    const { sourceAsksFor } = await import('./local-user');
    const hosted = sourceAsksFor({});
    expect(hosted.open).toBeGreaterThan(sourceAsksFor({ PUBLIC_FEEGA_LOCAL: '1' }).open);
    expect(hosted.framesPerAsk).toBeGreaterThanOrEqual(3);
  });
});

describe('pictures fetched at once, per mode', () => {
  it('local lets a few frames fetch pictures while on-screen vectors are owed and caps them after, so the nearest go first; hosted never holds them', async () => {
    const { pictureLimitsFor } = await import('./local-user');
    expect(pictureLimitsFor({ PUBLIC_FEEGA_LOCAL: '1' })).toEqual({ whileOwed: 3, open: 6 });
    expect(pictureLimitsFor({})).toEqual({ whileOwed: Infinity, open: Infinity });
  });
});
