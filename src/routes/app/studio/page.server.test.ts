import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioOptions } from '$lib/server/studio/studio-options';

const options: StudioOptions = {
  products: [
    { id: 'p1', nodeId: 'n', title: 'Linen shirt', image: null, imageCount: 1, productType: null, tags: [], kids: false, source: {} as never },
    { id: 'p2', nodeId: 'n', title: 'Baby onesie', image: null, imageCount: 1, productType: null, tags: ['baby'], kids: true, source: {} as never }
  ],
  models: [
    { id: 'synthetic', name: 'Ava', age: 25, cover: null, viewCount: 3, allowed: true, why: '' },
    { id: 'talent', name: 'Real', age: 30, cover: null, viewCount: 3, allowed: false, why: 'Catalogue talents are real people' }
  ],
  imageModels: [
    { id: 'pro', label: 'Pro', credits: 14, maxRefs: 5 },
    { id: 'lite', label: 'Lite', credits: 3, maxRefs: 10 }
  ],
  defaultModel: 'pro',
  previewModel: 'lite'
};

vi.mock('$lib/server/dashboard/tool-scope', () => ({
  toolScope: vi.fn(async () => ({ db: {}, orgId: 'org', projectId: 'proj', userId: 'u' }))
}));
vi.mock('$lib/server/studio/studio-options', () => ({ studioOptions: vi.fn(async () => options) }));
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiActionForForm: vi.fn(async () => undefined) }));
vi.mock('$lib/server/credits', () => ({ orgCreditBalance: vi.fn(async () => 5) }));

const { actions } = await import('./+page.server');

function event(selection: unknown) {
  const body = new FormData();
  body.set('selection', JSON.stringify(selection));
  return { request: new Request('http://x', { method: 'POST', body }), params: { projectId: 'proj' }, locals: {} } as never;
}

const base = { name: 'B', productIds: ['p1', 'p2'], modelIds: ['synthetic'], environments: ['white_ecom'], shots: ['packshot', 'on_model_front'], variations: 1, model: 'pro' };

describe('studio actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('quote: conta, prezza e spiega cosa salta', async () => {
    const out = (await actions.quote(event(base))) as { quote: { count: number; total: number; previewPerImage: number; skipped: string[] } };
    expect(out.quote.count).toBe(3);
    expect(out.quote.total).toBe(42);
    expect(out.quote.previewPerImage).toBe(3);
    expect(out.quote.skipped).toEqual(["Baby onesie · On-model front: kids' product: packshot and detail only"]);
  });

  it('quote: rifiuta un talento reale del catalogo', async () => {
    const out = (await actions.quote(event({ ...base, modelIds: ['talent'] }))) as { status: number; data: { error: string } };
    expect(out.status).toBe(422);
    expect(out.data.error).toMatch(/real people/);
  });

  it('quote: i riferimenti di stile esigono la conferma «nessuna persona»', async () => {
    const refs = [{ source: 'catalogue', id: 'c1' }];
    const refused = (await actions.quote(event({ ...base, styleRefs: refs }))) as { status: number };
    expect(refused.status).toBe(422);
    const ok = (await actions.quote(event({ ...base, styleRefs: refs, noPeopleConfirmed: true }))) as { quote: { droppedRefs: number } };
    expect(ok.quote.droppedRefs).toBe(0);
  });

  it('quote: dice quanti riferimenti di stile il modello lascia cadere', async () => {
    const refs = Array.from({ length: 4 }, (_, i) => ({ source: 'catalogue', id: `c${i}` }));
    const out = (await actions.quote(event({ ...base, styleRefs: refs, noPeopleConfirmed: true }))) as { quote: { droppedRefs: number } };
    expect(out.quote.droppedRefs).toBe(3);
  });

  it('preview: blocca quando i crediti non coprono l’anteprima, prima di scrivere qualcosa', async () => {
    const out = (await actions.preview(event({ ...base, productIds: ['p1'], shots: ['packshot'], variations: 3 }))) as { status: number; data: { error: string } };
    expect(out.status).toBe(422);
    expect(out.data.error).toMatch(/Not enough credits: the preview costs 9, you have 5/);
  });
});
