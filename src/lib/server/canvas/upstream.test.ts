import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { upstreamInputsFor } from './upstream';

const { modalitiesOf } = vi.hoisted(() => ({ modalitiesOf: vi.fn() }));
vi.mock('$lib/server/ai-models-sync', () => ({ modalitiesOf }));
vi.mock('$lib/server/supabase-admin', () => ({ createAdminClient: () => ({}) }));

const ORG = '11111111-1111-1111-1111-111111111111';
const CANVAS = '22222222-2222-2222-2222-222222222222';
const TEXT_NODE = '33333333-3333-3333-3333-333333333333';
const IMAGE_NODE = '44444444-4444-4444-4444-444444444444';
const VIDEO_NODE = '66666666-6666-6666-6666-666666666666';
const SOURCE_VIDEO_NODE = '77777777-7777-7777-7777-777777777777';
const ASSET = '55555555-5555-5555-5555-555555555555';
const VIDEO_ASSET = '88888888-8888-8888-8888-888888888888';
const INFLUENCER_NODE = '99999999-9999-9999-9999-999999999999';
const LIST_NODE = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const SELECT_NODE = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const IMAGE_ASSET_1 = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const IMAGE_ASSET_2 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const INFLUENCER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PRODUCTS_NODE = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const FEED_NODE = '10101010-1010-1010-1010-101010101010';

const MODEL = 'bytedance/seedance-2-5';

const nodeRow = (id: string, type: string, data: Record<string, unknown>) => ({
  id,
  canvas_id: CANVAS,
  project_id: 'p1',
  type,
  display_name: null,
  x: 0,
  y: 0,
  z: 0,
  width: null,
  height: null,
  data,
  version: 1
});

beforeEach(() => {
  modalitiesOf.mockReset();
  modalitiesOf.mockResolvedValue({ input: ['text', 'image', 'video', 'audio'], output: ['video'], synced_at: 'now', uncensored: false });
});

describe('upstreamInputsFor — dal database alla forma pura', () => {
  it('legge il testo dell\'ultimo giro di un nodo testo attraverso il suo asset', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(TEXT_NODE, 'text', { prompt: 'scrivi qualcosa', refId: ASSET }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: MODEL })
      ],
      nodes_connections: [
        {
          id: 'e1',
          canvas_id: CANVAS,
          source_node_id: TEXT_NODE,
          target_node_id: IMAGE_NODE,
          source_handle: null,
          target_handle: null
        }
      ],
      assets: [{ id: ASSET, project_id: 'p1', type: 'text', url: null, content: 'ciao mondo', mime_type: 'text/plain', bytes: null, width: null, height: null, duration_s: null, source: 'generated', source_node_id: TEXT_NODE, created_at: 'now' }]
    });

    const out = await upstreamInputsFor(db, {
      orgId: ORG,
      canvasId: CANVAS,
      nodeId: IMAGE_NODE,
      model: MODEL,
      medium: 'image'
    });

    expect(out.text).toEqual(['ciao mondo']);
    expect(out.blocked).toBeNull();
  });

  it('un nodo testo mai girato alimenta col suo prompt, non con niente', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(TEXT_NODE, 'text', { prompt: 'scrivi qualcosa' }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: MODEL })
      ],
      nodes_connections: [
        {
          id: 'e1',
          canvas_id: CANVAS,
          source_node_id: TEXT_NODE,
          target_node_id: IMAGE_NODE,
          source_handle: null,
          target_handle: null
        }
      ],
      assets: []
    });

    const out = await upstreamInputsFor(db, {
      orgId: ORG,
      canvasId: CANVAS,
      nodeId: IMAGE_NODE,
      model: MODEL,
      medium: 'image'
    });

    expect(out.text).toEqual(['scrivi qualcosa']);
    expect(out.rejected).toEqual([]);
  });

  it('legge il `content` di un `doc` senza passare da un asset', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(TEXT_NODE, 'doc', { content: 'appunti', public: false }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: MODEL })
      ],
      nodes_connections: [
        {
          id: 'e1',
          canvas_id: CANVAS,
          source_node_id: TEXT_NODE,
          target_node_id: IMAGE_NODE,
          source_handle: null,
          target_handle: null
        }
      ],
      assets: []
    });

    const out = await upstreamInputsFor(db, {
      orgId: ORG,
      canvasId: CANVAS,
      nodeId: IMAGE_NODE,
      model: MODEL,
      medium: 'image'
    });

    expect(out.text).toEqual(['appunti']);
  });

  it('un nodo senza archi in ingresso non riceve niente', async () => {
    const { db } = fakeDb({
      nodes: [nodeRow(IMAGE_NODE, 'image', { prompt: '', model: MODEL })],
      nodes_connections: [],
      assets: []
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: MODEL });

    expect(out).toMatchObject({ text: [], referenceImageUrls: [], rejected: [], blocked: null });
  });

  it('senza un modello scelto sul nodo, nessun controllo parte e le modalità restano vuote', async () => {
    const { db } = fakeDb({
      nodes: [nodeRow(IMAGE_NODE, 'image', { prompt: '' })],
      nodes_connections: [],
      assets: []
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE });

    expect(out.blocked).toBeNull();
    expect(modalitiesOf).not.toHaveBeenCalled();
  });
});

describe('upstreamInputsFor — un nodo influencer, dal database vero fino al resolver', () => {
  /**
   * IL GIRO REALE, NON SOLO IL RESOLVER PURO: `resolveUpstreamInputs` (testato a parte in
   * `upstream-inputs.test.ts`) accetta già `mediaUrls`, ma questo file è quello che li COSTRUISCE
   * da `influencer_views` — senza questa lettura, un influencer collegato alla tela darebbe
   * sempre zero riferimenti, non un problema di logica ma di collegamento mancante (CLAUDE.md:
   * "una funzione non esiste finché non è collegata"). Qui si prova che `toUpstreamNode` legge
   * `influencer_views`, le firma e le passa nell'ordine giusto.
   */
  it('le viste di un influencer collegato diventano referenceImageUrls, firmate e ordinate', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(INFLUENCER_NODE, 'influencer', { influencer_id: INFLUENCER_ID }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: 'qwen3-pro' })
      ],
      nodes_connections: [
        {
          id: 'e1',
          canvas_id: CANVAS,
          source_node_id: INFLUENCER_NODE,
          target_node_id: IMAGE_NODE,
          source_handle: null,
          target_handle: null
        }
      ],
      // `fakeDb` non applica `.order()` davvero — quello è compito di Postgres, non di questo
      // codice — quindi le righe arrivano già nell'ordine che `sort_order` produrrebbe: questo
      // test prova che `toUpstreamNode` LEGGE e passa `influencer_views` intatte, non che
      // Supabase sappia ordinare una `select`.
      influencer_views: [
        {
          id: 'v1',
          influencer_id: INFLUENCER_ID,
          view_key: 'face-front',
          label: 'Face · Front',
          storage_path: `catalogue/${INFLUENCER_ID}/face-front.webp`,
          mime_type: 'image/webp',
          width: 1024,
          height: 1365,
          sort_order: 10
        },
        {
          id: 'v2',
          influencer_id: INFLUENCER_ID,
          view_key: 'body-front',
          label: 'Body · Front',
          storage_path: `catalogue/${INFLUENCER_ID}/body-front.webp`,
          mime_type: 'image/webp',
          width: 1024,
          height: 1365,
          sort_order: 20
        }
      ],
      assets: []
    });

    const out = await upstreamInputsFor(db, {
      orgId: ORG,
      canvasId: CANVAS,
      nodeId: IMAGE_NODE,
      model: 'qwen3-pro',
      medium: 'image'
    });

    expect(out.blocked).toBeNull();
    expect(out.referenceImageUrls).toEqual([
      `https://signed.example/influencers/catalogue/${INFLUENCER_ID}/face-front.webp`,
      `https://signed.example/influencers/catalogue/${INFLUENCER_ID}/body-front.webp`
    ]);
    expect(out.referenceImageUrl).toBe(out.referenceImageUrls[0]);
    expect(out.rejected).toEqual([]);
  });

  it('un influencer senza viste ancora importate non alimenta niente, e non spacca il giro', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(INFLUENCER_NODE, 'influencer', { influencer_id: INFLUENCER_ID }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: MODEL })
      ],
      nodes_connections: [
        {
          id: 'e1',
          canvas_id: CANVAS,
          source_node_id: INFLUENCER_NODE,
          target_node_id: IMAGE_NODE,
          source_handle: null,
          target_handle: null
        }
      ],
      influencer_views: [],
      assets: []
    });

    const out = await upstreamInputsFor(db, {
      orgId: ORG,
      canvasId: CANVAS,
      nodeId: IMAGE_NODE,
      model: MODEL,
      medium: 'image'
    });

    expect(out.referenceImageUrls).toEqual([]);
    expect(out.rejected).toEqual([{ nodeId: INFLUENCER_NODE, why: expect.stringContaining('not run yet') }]);
  });
});

describe('upstreamInputsFor — un modello sparito da ai_models blocca il nodo', () => {
  const videoToVideoDb = () =>
    fakeDb({
      nodes: [
        nodeRow(SOURCE_VIDEO_NODE, 'video', { prompt: 'una clip', refId: VIDEO_ASSET }),
        nodeRow(VIDEO_NODE, 'video', { prompt: '', model: MODEL })
      ],
      nodes_connections: [
        {
          id: 'e1',
          canvas_id: CANVAS,
          source_node_id: SOURCE_VIDEO_NODE,
          target_node_id: VIDEO_NODE,
          source_handle: null,
          target_handle: null
        }
      ],
      assets: [
        {
          id: VIDEO_ASSET,
          project_id: 'p1',
          type: 'video',
          url: 'https://cdn/clip.mp4',
          content: null,
          mime_type: 'video/mp4',
          bytes: null,
          width: null,
          height: null,
          duration_s: 5,
          source: 'generated',
          source_node_id: SOURCE_VIDEO_NODE,
          created_at: 'now'
        }
      ]
    });

  it('un modello sincronizzato risolve normalmente, mai bloccato', async () => {
    const { db } = videoToVideoDb();

    const out = await upstreamInputsFor(db, {
      orgId: ORG,
      canvasId: CANVAS,
      nodeId: VIDEO_NODE,
      model: MODEL,
      medium: 'video'
    });

    expect(out.blocked).toBeNull();
    expect(out.referenceVideoUrls).toEqual(['https://cdn/clip.mp4']);
  });

  it('un modello che `ai_models` non conferma più blocca il nodo intero, con la ragione', async () => {
    modalitiesOf.mockResolvedValue(null);
    const { db } = videoToVideoDb();

    const out = await upstreamInputsFor(db, {
      orgId: ORG,
      canvasId: CANVAS,
      nodeId: VIDEO_NODE,
      model: MODEL,
      medium: 'video'
    });

    expect(out.blocked).toContain(MODEL);
    // Bloccato vuol dire NIENTE risolto — non un arco rifiutato, il nodo intero non gira.
    expect(out.referenceVideoUrls).toEqual([]);
    expect(out.text).toEqual([]);
  });

  it('un modello bloccato non legge nemmeno nodi e archi: nessuna query sprecata', async () => {
    modalitiesOf.mockResolvedValue(null);
    const { db, calls } = fakeDb({ nodes: [], nodes_connections: [], assets: [] });

    await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: VIDEO_NODE, model: MODEL, medium: 'video' });

    expect(calls.some((c) => c.table === 'nodes')).toBe(false);
    expect(calls.some((c) => c.table === 'nodes_connections')).toBe(false);
  });

  it('senza un medium, nessun controllo modello parte — non sa quale spec tradurre', async () => {
    modalitiesOf.mockResolvedValue(null);
    const { db, calls } = fakeDb({ nodes: [], nodes_connections: [], assets: [] });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: VIDEO_NODE, model: MODEL });

    expect(out.blocked).toBeNull();
    expect(modalitiesOf).not.toHaveBeenCalled();
    expect(calls.some((c) => c.table === 'nodes')).toBe(true);
  });

  it('un modello che NON prende video (ma esiste) rifiuta solo quell\'arco, non blocca il nodo', async () => {
    modalitiesOf.mockResolvedValue({ input: ['text', 'image'], output: ['video'], synced_at: 'now' });
    const { db } = videoToVideoDb();

    const out = await upstreamInputsFor(db, {
      orgId: ORG,
      canvasId: CANVAS,
      nodeId: VIDEO_NODE,
      model: MODEL,
      medium: 'video'
    });

    expect(out.blocked).toBeNull();
    expect(out.referenceVideoUrls).toEqual([]);
    expect(out.rejected).toEqual([{ nodeId: SOURCE_VIDEO_NODE, why: expect.stringContaining('has no') }]);
  });

  it('passa il medium a `modalitiesOf`, così l\'id interno si traduce sul listino giusto', async () => {
    const { db } = videoToVideoDb();

    await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: VIDEO_NODE, model: MODEL, medium: 'video' });

    expect(modalitiesOf).toHaveBeenCalledWith(expect.anything(), MODEL, 'video');
  });
});

describe('upstreamInputsFor — un nodo testo apre le sue porte dal listino `chat`, ma non si blocca mai', () => {
  const TEXT_MODEL = 'anthropic/claude-haiku-4.5';

  const imageToTextDb = () =>
    fakeDb({
      nodes: [
        nodeRow(IMAGE_NODE, 'image', { prompt: '', refId: ASSET }),
        nodeRow(TEXT_NODE, 'text', { prompt: 'descrivi questa immagine', model: TEXT_MODEL })
      ],
      nodes_connections: [
        {
          id: 'e1',
          canvas_id: CANVAS,
          source_node_id: IMAGE_NODE,
          target_node_id: TEXT_NODE,
          source_handle: null,
          target_handle: null
        }
      ],
      assets: [
        {
          id: ASSET,
          project_id: 'p1',
          type: 'image',
          url: 'https://cdn/upstream.png',
          content: null,
          mime_type: 'image/png',
          bytes: null,
          width: null,
          height: null,
          duration_s: null,
          source: 'generated',
          source_node_id: IMAGE_NODE,
          created_at: 'now'
        }
      ]
    });

  it('un modello di chat che legge immagini apre il connettore immagini per il testo a monte', async () => {
    modalitiesOf.mockResolvedValue({ input: ['text', 'image'], output: ['text'], synced_at: 'now' });
    const { db } = imageToTextDb();

    const out = await upstreamInputsFor(db, {
      orgId: ORG,
      canvasId: CANVAS,
      nodeId: TEXT_NODE,
      model: TEXT_MODEL,
      medium: 'text'
    });

    expect(out.blocked).toBeNull();
    expect(out.referenceImageUrls).toEqual(['https://cdn/upstream.png']);
  });

  it('cerca sul listino chat, non su image/video', async () => {
    modalitiesOf.mockResolvedValue({ input: ['text'], output: ['text'], synced_at: 'now' });
    const { db } = imageToTextDb();

    await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: TEXT_NODE, model: TEXT_MODEL, medium: 'text' });

    expect(modalitiesOf).toHaveBeenCalledWith(expect.anything(), TEXT_MODEL, 'chat');
  });

  it('un modello di chat non ancora sincronizzato NON blocca il nodo: rifiuta solo l\'immagine collegata', async () => {
    modalitiesOf.mockResolvedValue(null);
    const { db } = imageToTextDb();

    const out = await upstreamInputsFor(db, {
      orgId: ORG,
      canvasId: CANVAS,
      nodeId: TEXT_NODE,
      model: TEXT_MODEL,
      medium: 'text'
    });

    expect(out.blocked).toBeNull();
    expect(out.referenceImageUrls).toEqual([]);
    expect(out.rejected).toEqual([{ nodeId: IMAGE_NODE, why: expect.stringContaining('has no') }]);
  });
});

describe('upstreamInputsFor — list: fisso, porta ogni item risolto ad asset reale', () => {
  it('una lista immagini con asset_id alimenta referenceImageUrls con gli url veri', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(LIST_NODE, 'list', {
          item_kind: 'image',
          items: [{ label: 'a', asset_id: IMAGE_ASSET_1 }, { label: 'b', asset_id: IMAGE_ASSET_2 }]
        }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: 'qwen3-pro' })
      ],
      nodes_connections: [
        { id: 'e1', canvas_id: CANVAS, source_node_id: LIST_NODE, target_node_id: IMAGE_NODE, source_handle: null, target_handle: null }
      ],
      assets: [
        { id: IMAGE_ASSET_1, project_id: 'p1', type: 'image', url: 'canvas-assets/a.png', content: null, mime_type: 'image/png', bytes: null, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, created_at: 'now' },
        { id: IMAGE_ASSET_2, project_id: 'p1', type: 'image', url: 'canvas-assets/b.png', content: null, mime_type: 'image/png', bytes: null, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, created_at: 'now' }
      ]
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: 'qwen3-pro', medium: 'image' });

    expect(out.blocked).toBeNull();
    expect(out.referenceImageUrls).toEqual(['canvas-assets/a.png', 'canvas-assets/b.png']);
    expect(out.rejected).toEqual([]);
  });

  it('una lista di testo su un filo fisso porta ogni riga come UN blocco di testo (il connettore non è list-valued)', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(LIST_NODE, 'list', { item_kind: 'text', items: [{ label: 'a', text: 'primo' }, { label: 'b', text: 'secondo' }] }),
        nodeRow(TEXT_NODE, 'text', { prompt: '' })
      ],
      nodes_connections: [
        { id: 'e1', canvas_id: CANVAS, source_node_id: LIST_NODE, target_node_id: TEXT_NODE, source_handle: null, target_handle: null }
      ],
      assets: []
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: TEXT_NODE });

    expect(out.text).toEqual(['primo\n\nsecondo']);
  });
});

describe('upstreamInputsFor — list con nodi collegati: i fili portano l\'output vivo della sorgente', () => {
  const WIRED_A = 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1';
  const WIRED_B = 'f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2';
  const WIRED_EMPTY = 'f3f3f3f3-f3f3-f3f3-f3f3-f3f3f3f3f3f3';
  const asset = (id: string, url: string) => ({ id, org_id: ORG, project_id: 'p1', type: 'image', url, content: null, mime_type: 'image/png', bytes: null, width: null, height: null, duration_s: null, source: 'generated', source_node_id: null, created_at: 'now' });
  const row = (id: string, type: string, data: Record<string, unknown>) => ({ ...nodeRow(id, type, data), org_id: ORG, deleted_at: null });
  const edge = (id: string, source: string, target: string) => ({ id, org_id: ORG, canvas_id: CANVAS, source_node_id: source, target_node_id: target, source_handle: null, target_handle: null, mode: 'fixed', deleted_at: null });

  it('una lista riempita da due immagini collegate alimenta i loro asset, dopo gli item manuali', async () => {
    const { db } = fakeDb({
      nodes: [
        row(LIST_NODE, 'list', { item_kind: 'image', items: [{ label: 'a', asset_id: ASSET }] }),
        row(WIRED_A, 'image', { prompt: 'uno', refId: IMAGE_ASSET_1 }),
        row(WIRED_B, 'image', { prompt: 'due', refId: IMAGE_ASSET_2 }),
        row(WIRED_EMPTY, 'image', { prompt: 'mai girato', refId: null }),
        row(IMAGE_NODE, 'image', { prompt: '', model: 'qwen3-pro' })
      ],
      nodes_connections: [
        edge('e1', WIRED_A, LIST_NODE),
        edge('e2', WIRED_EMPTY, LIST_NODE),
        edge('e3', WIRED_B, LIST_NODE),
        edge('e4', LIST_NODE, IMAGE_NODE)
      ],
      assets: [asset(ASSET, 'canvas-assets/manual.png'), asset(IMAGE_ASSET_1, 'canvas-assets/a.png'), asset(IMAGE_ASSET_2, 'canvas-assets/b.png')]
    }, { filter: true });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: 'qwen3-pro', medium: 'image' });

    expect(out.referenceImageUrls).toEqual(['canvas-assets/manual.png', 'canvas-assets/a.png', 'canvas-assets/b.png']);
  });

  it('un\'iterazione di loop su un item collegato vede l\'asset della sorgente', async () => {
    const { db } = fakeDb({
      nodes: [
        row(LIST_NODE, 'list', { item_kind: 'image', items: [] }),
        row(WIRED_A, 'image', { prompt: 'uno', refId: IMAGE_ASSET_1 }),
        row(WIRED_B, 'image', { prompt: 'due', refId: IMAGE_ASSET_2 }),
        row(IMAGE_NODE, 'image', { prompt: '', model: 'qwen3-pro' })
      ],
      nodes_connections: [edge('e1', WIRED_A, LIST_NODE), edge('e2', WIRED_B, LIST_NODE), edge('e3', LIST_NODE, IMAGE_NODE)],
      assets: [asset(IMAGE_ASSET_1, 'canvas-assets/a.png'), asset(IMAGE_ASSET_2, 'canvas-assets/b.png')]
    }, { filter: true });

    const out = await upstreamInputsFor(db, {
      orgId: ORG,
      canvasId: CANVAS,
      nodeId: IMAGE_NODE,
      model: 'qwen3-pro',
      medium: 'image',
      iterateSelection: { [LIST_NODE]: 2 }
    });

    expect(out.referenceImageUrls.concat(out.referenceImageUrl ? [out.referenceImageUrl] : [])).toContain('canvas-assets/b.png');
    expect(out.referenceImageUrls).not.toContain('canvas-assets/a.png');
  });
});

describe('upstreamInputsFor — select: risolve ESATTAMENTE l\'item scelto dalla lista a monte', () => {
  it('un select su una lista immagini porta solo l\'item all\'indice scelto (1-based)', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(LIST_NODE, 'list', {
          item_kind: 'image',
          items: [{ label: 'a', asset_id: IMAGE_ASSET_1 }, { label: 'b', asset_id: IMAGE_ASSET_2 }]
        }),
        nodeRow(SELECT_NODE, 'select', { index: 2 }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: 'qwen3-pro' })
      ],
      nodes_connections: [
        { id: 'e-list-select', canvas_id: CANVAS, source_node_id: LIST_NODE, target_node_id: SELECT_NODE, source_handle: null, target_handle: null },
        { id: 'e-select-image', canvas_id: CANVAS, source_node_id: SELECT_NODE, target_node_id: IMAGE_NODE, source_handle: null, target_handle: null }
      ],
      assets: [
        { id: IMAGE_ASSET_1, project_id: 'p1', type: 'image', url: 'canvas-assets/a.png', content: null, mime_type: 'image/png', bytes: null, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, created_at: 'now' },
        { id: IMAGE_ASSET_2, project_id: 'p1', type: 'image', url: 'canvas-assets/b.png', content: null, mime_type: 'image/png', bytes: null, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, created_at: 'now' }
      ]
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: 'qwen3-pro', medium: 'image' });

    expect(out.blocked).toBeNull();
    expect(out.referenceImageUrls).toEqual(['canvas-assets/b.png']);
    expect(out.rejected).toEqual([]);
  });

  it('un select fuori range non alimenta niente, e lo dice — mai un valore a caso', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(LIST_NODE, 'list', { item_kind: 'image', items: [{ label: 'a', asset_id: IMAGE_ASSET_1 }] }),
        nodeRow(SELECT_NODE, 'select', { index: 5 }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: 'qwen3-pro' })
      ],
      nodes_connections: [
        { id: 'e-list-select', canvas_id: CANVAS, source_node_id: LIST_NODE, target_node_id: SELECT_NODE, source_handle: null, target_handle: null },
        { id: 'e-select-image', canvas_id: CANVAS, source_node_id: SELECT_NODE, target_node_id: IMAGE_NODE, source_handle: null, target_handle: null }
      ],
      assets: [
        { id: IMAGE_ASSET_1, project_id: 'p1', type: 'image', url: 'canvas-assets/a.png', content: null, mime_type: 'image/png', bytes: null, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, created_at: 'now' }
      ]
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: 'qwen3-pro', medium: 'image' });

    expect(out.referenceImageUrls).toEqual([]);
    expect(out.rejected).toEqual([{ nodeId: SELECT_NODE, why: expect.stringContaining('not run yet') }]);
  });

  it('un select senza lista a monte (referenza rotta) non alimenta niente', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(SELECT_NODE, 'select', { index: 1 }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: 'qwen3-pro' })
      ],
      nodes_connections: [
        { id: 'e-select-image', canvas_id: CANVAS, source_node_id: SELECT_NODE, target_node_id: IMAGE_NODE, source_handle: null, target_handle: null }
      ],
      assets: []
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: 'qwen3-pro', medium: 'image' });

    expect(out.referenceImageUrls).toEqual([]);
    expect(out.rejected).toEqual([{ nodeId: SELECT_NODE, why: expect.stringContaining('not run yet') }]);
  });
});

describe('upstreamInputsFor — select su products/social_account_feed: intrinsecamente liste anche loro', () => {
  it('un select su un catalogo prodotti porta titolo+descrizione come testo e le foto come immagini', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(PRODUCTS_NODE, 'products', { type: 'shopify', url: 'https://x.myshopify.com' }),
        nodeRow(SELECT_NODE, 'select', { index: 2 }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: 'qwen3-pro' })
      ],
      nodes_connections: [
        { id: 'e-products-select', canvas_id: CANVAS, source_node_id: PRODUCTS_NODE, target_node_id: SELECT_NODE, source_handle: null, target_handle: null },
        { id: 'e-select-image', canvas_id: CANVAS, source_node_id: SELECT_NODE, target_node_id: IMAGE_NODE, source_handle: null, target_handle: null }
      ],
      products: [
        { id: 'pr1', org_id: ORG, node_id: PRODUCTS_NODE, project_id: 'p1', platform: 'shopify', external_id: '1', handle: 'a', title: 'Sedia', description: 'Rossa', price: 10, currency: 'EUR', url: null, images: [{ url: 'canvas-assets/sedia.png' }], available: true, synced_at: 'now', created_at: 'now' },
        { id: 'pr2', org_id: ORG, node_id: PRODUCTS_NODE, project_id: 'p1', platform: 'shopify', external_id: '2', handle: 'b', title: 'Tavolo', description: 'Blu', price: 20, currency: 'EUR', url: null, images: [{ url: 'canvas-assets/tavolo.png' }], available: true, synced_at: 'now', created_at: 'now' }
      ],
      assets: []
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: 'qwen3-pro', medium: 'image' });

    expect(out.blocked).toBeNull();
    expect(out.referenceImageUrls).toEqual(['canvas-assets/tavolo.png']);
  });

  it('un select su un feed social porta le slide di un carosello, tutte', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(FEED_NODE, 'social_account_feed', { platform: 'instagram', handle: 'acme' }),
        nodeRow(SELECT_NODE, 'select', { index: 1 }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: 'qwen3-pro' })
      ],
      nodes_connections: [
        { id: 'e-feed-select', canvas_id: CANVAS, source_node_id: FEED_NODE, target_node_id: SELECT_NODE, source_handle: null, target_handle: null },
        { id: 'e-select-image', canvas_id: CANVAS, source_node_id: SELECT_NODE, target_node_id: IMAGE_NODE, source_handle: null, target_handle: null }
      ],
      social_posts: [
        {
          id: 'sp1',
          org_id: ORG,
          node_id: FEED_NODE,
          project_id: 'p1',
          platform: 'instagram',
          external_id: 'ext1',
          handle: 'acme',
          caption: 'Nuova collezione',
          media: { items: [{ type: 'image', url: 'canvas-assets/s1.png' }, { type: 'image', url: 'canvas-assets/s2.png' }] },
          metrics: {},
          permalink: null,
          posted_at: 'now',
          fetched_at: 'now'
        }
      ],
      assets: []
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: 'qwen3-pro', medium: 'image' });

    expect(out.blocked).toBeNull();
    expect(out.referenceImageUrls).toEqual(['canvas-assets/s1.png', 'canvas-assets/s2.png']);
  });

  it('un select su un feed social senza slide (post singolo) alimenta con la sua copertina', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(FEED_NODE, 'social_account_feed', { platform: 'instagram', handle: 'acme' }),
        nodeRow(SELECT_NODE, 'select', { index: 1 }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: 'qwen3-pro' })
      ],
      nodes_connections: [
        { id: 'e-feed-select', canvas_id: CANVAS, source_node_id: FEED_NODE, target_node_id: SELECT_NODE, source_handle: null, target_handle: null },
        { id: 'e-select-image', canvas_id: CANVAS, source_node_id: SELECT_NODE, target_node_id: IMAGE_NODE, source_handle: null, target_handle: null }
      ],
      social_posts: [
        {
          id: 'sp1',
          org_id: ORG,
          node_id: FEED_NODE,
          project_id: 'p1',
          platform: 'instagram',
          external_id: 'ext1',
          handle: 'acme',
          caption: null,
          media: { thumbnailUrl: 'canvas-assets/cover.png' },
          metrics: {},
          permalink: null,
          posted_at: 'now',
          fetched_at: 'now'
        }
      ],
      assets: []
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: 'qwen3-pro', medium: 'image' });

    expect(out.referenceImageUrls).toEqual(['canvas-assets/cover.png']);
  });
});

describe('upstreamInputsFor — iterateSelection: UNA iterazione di un loop vede UN item, non la lista intera', () => {
  it('un nodeId in iterateSelection fa risolvere quella list come un select a quell\'indice, per questa sola chiamata', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(LIST_NODE, 'list', {
          item_kind: 'image',
          items: [{ label: 'a', asset_id: IMAGE_ASSET_1 }, { label: 'b', asset_id: IMAGE_ASSET_2 }]
        }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: 'qwen3-pro' })
      ],
      nodes_connections: [
        { id: 'e1', canvas_id: CANVAS, source_node_id: LIST_NODE, target_node_id: IMAGE_NODE, source_handle: null, target_handle: null }
      ],
      assets: [
        { id: IMAGE_ASSET_1, project_id: 'p1', type: 'image', url: 'canvas-assets/a.png', content: null, mime_type: 'image/png', bytes: null, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, created_at: 'now' },
        { id: IMAGE_ASSET_2, project_id: 'p1', type: 'image', url: 'canvas-assets/b.png', content: null, mime_type: 'image/png', bytes: null, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, created_at: 'now' }
      ]
    });

    const first = await upstreamInputsFor(db, {
      orgId: ORG,
      canvasId: CANVAS,
      nodeId: IMAGE_NODE,
      model: 'qwen3-pro',
      medium: 'image',
      iterateSelection: { [LIST_NODE]: 1 }
    });
    expect(first.referenceImageUrls).toEqual(['canvas-assets/a.png']);

    const second = await upstreamInputsFor(db, {
      orgId: ORG,
      canvasId: CANVAS,
      nodeId: IMAGE_NODE,
      model: 'qwen3-pro',
      medium: 'image',
      iterateSelection: { [LIST_NODE]: 2 }
    });
    expect(second.referenceImageUrls).toEqual(['canvas-assets/b.png']);
  });

  it('senza iterateSelection, la stessa lista alimenta ancora TUTTI i suoi item (comportamento fixed, invariato)', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(LIST_NODE, 'list', {
          item_kind: 'image',
          items: [{ label: 'a', asset_id: IMAGE_ASSET_1 }, { label: 'b', asset_id: IMAGE_ASSET_2 }]
        }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: 'qwen3-pro' })
      ],
      nodes_connections: [
        { id: 'e1', canvas_id: CANVAS, source_node_id: LIST_NODE, target_node_id: IMAGE_NODE, source_handle: null, target_handle: null }
      ],
      assets: [
        { id: IMAGE_ASSET_1, project_id: 'p1', type: 'image', url: 'canvas-assets/a.png', content: null, mime_type: 'image/png', bytes: null, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, created_at: 'now' },
        { id: IMAGE_ASSET_2, project_id: 'p1', type: 'image', url: 'canvas-assets/b.png', content: null, mime_type: 'image/png', bytes: null, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, created_at: 'now' }
      ]
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: 'qwen3-pro', medium: 'image' });

    expect(out.referenceImageUrls).toEqual(['canvas-assets/a.png', 'canvas-assets/b.png']);
  });
});

describe('upstreamInputsFor — effects: alimenta a valle col suo refId, come ogni nodo che produce un\'immagine', () => {
  const EFFECTS_NODE = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  it('un effects già applicato alimenta col suo refId, non col sourceRefId che l\'ha alimentato', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(EFFECTS_NODE, 'effects', {
          effects: [{ id: 'pixelate', params: { blockSize: 8 } }],
          refId: IMAGE_ASSET_1,
          sourceRefId: IMAGE_ASSET_2
        }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: MODEL })
      ],
      nodes_connections: [
        { id: 'e1', canvas_id: CANVAS, source_node_id: EFFECTS_NODE, target_node_id: IMAGE_NODE, source_handle: null, target_handle: null }
      ],
      assets: [
        { id: IMAGE_ASSET_1, project_id: 'p1', type: 'image', url: 'canvas-assets/applied.png', content: null, mime_type: 'image/png', bytes: null, width: null, height: null, duration_s: null, source: 'generated', source_node_id: EFFECTS_NODE, created_at: 'now' },
        { id: IMAGE_ASSET_2, project_id: 'p1', type: 'image', url: 'canvas-assets/source.png', content: null, mime_type: 'image/png', bytes: null, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, created_at: 'now' }
      ]
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: MODEL, medium: 'image' });

    expect(out.referenceImageUrls).toEqual(['canvas-assets/applied.png']);
  });

  it('un effects mai applicato (senza refId) non alimenta niente, mai un valore a caso', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(EFFECTS_NODE, 'effects', { effects: [] }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: MODEL })
      ],
      nodes_connections: [
        { id: 'e1', canvas_id: CANVAS, source_node_id: EFFECTS_NODE, target_node_id: IMAGE_NODE, source_handle: null, target_handle: null }
      ],
      assets: []
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: MODEL, medium: 'image' });

    expect(out.referenceImageUrls).toEqual([]);
  });
});

describe('upstreamInputsFor — il select vede il feed filtrato, non le righe grezze', () => {
  it('index 1 su un feed filtrato a soli video dà il primo video, non il primo post', async () => {
    const post = (id: string, type: string, url: string) => ({
      id,
      org_id: ORG,
      node_id: FEED_NODE,
      project_id: 'p1',
      platform: 'instagram',
      external_id: id,
      handle: 'acme',
      caption: id,
      media: { type, items: [{ type, url, thumbnailUrl: url }] },
      metrics: {},
      permalink: null,
      posted_at: id === 'foto' ? '2026-09-02T00:00:00Z' : '2026-09-01T00:00:00Z',
      fetched_at: 'now'
    });
    const { db } = fakeDb({
      nodes: [
        nodeRow(FEED_NODE, 'social_account_feed', { platform: 'instagram', handle: 'acme', filters: { media: 'video' } }),
        nodeRow(SELECT_NODE, 'select', { index: 1 }),
        nodeRow(IMAGE_NODE, 'image', { prompt: '', model: 'qwen3-pro' })
      ],
      nodes_connections: [
        { id: 'e-feed-select', canvas_id: CANVAS, source_node_id: FEED_NODE, target_node_id: SELECT_NODE, source_handle: null, target_handle: null },
        { id: 'e-select-image', canvas_id: CANVAS, source_node_id: SELECT_NODE, target_node_id: IMAGE_NODE, source_handle: null, target_handle: null }
      ],
      social_posts: [post('foto', 'image', 'canvas-assets/foto.png'), post('clip', 'video', 'canvas-assets/clip.png')],
      assets: []
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: 'qwen3-pro', medium: 'image' });

    expect(out.referenceImageUrls).toEqual(['canvas-assets/clip.png']);
  });
});

describe('upstreamInputsFor — riferimenti scelti sul nodo', () => {
  const CATALOGUE_ID = '12121212-1212-1212-1212-121212121212';

  it('un asset della libreria e una foto del catalogo globale arrivano come riferimenti, nell\'ordine scelto', async () => {
    modalitiesOf.mockResolvedValue({ input: ['text', 'image'], output: ['image'], synced_at: 'now' });
    const { db } = fakeDb(
      {
        nodes: [
          nodeRow(IMAGE_NODE, 'image', {
            prompt: 'x',
            model: 'qwen3-pro',
            references: [
              { source: 'catalogue', id: CATALOGUE_ID },
              { source: 'asset', id: IMAGE_ASSET_1 }
            ]
          })
        ],
        nodes_connections: [],
        assets: [{ id: IMAGE_ASSET_1, project_id: 'p1', type: 'image', url: `${ORG}/p1/own.png`, content: null, mime_type: 'image/png', bytes: 1, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, created_at: 'now' }],
        reference_images: [{ id: CATALOGUE_ID, org_id: null, name: 'Chrome sphere', storage_path: 'catalogue/model-01-chrome-sphere.png', mime_type: 'image/png', width: null, height: null, sort_order: 0 }]
      }
    );

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: 'qwen3-pro', medium: 'image' });

    expect(out.pickedImageUrls).toEqual([
      'https://signed.example/reference-images/catalogue/model-01-chrome-sphere.png',
      `${ORG}/p1/own.png`
    ]);
    expect(out.referenceImageUrl).toBeNull();
  });

  it('un modello uncensored rifiuta i riferimenti scelti sul nodo, dal database vero fino al resolver', async () => {
    modalitiesOf.mockResolvedValue({ input: ['text', 'image'], output: ['image'], synced_at: 'now', uncensored: true });
    const { db } = fakeDb({
      nodes: [
        nodeRow(IMAGE_NODE, 'image', {
          prompt: 'x',
          model: 'wiro/uncensored-image',
          references: [{ source: 'asset', id: IMAGE_ASSET_1 }]
        })
      ],
      nodes_connections: [],
      assets: [{ id: IMAGE_ASSET_1, project_id: 'p1', type: 'image', url: `${ORG}/p1/own.png`, content: null, mime_type: 'image/png', bytes: 1, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, created_at: 'now' }],
      reference_images: []
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: 'wiro/uncensored-image', medium: 'image' });

    expect(out.pickedImageUrls).toEqual([]);
    expect(out.rejected).toEqual([{ nodeId: IMAGE_NODE, why: expect.stringContaining('has no') }]);
  });

  it('un riferimento sparito si salta, non ferma il giro', async () => {
    const { db } = fakeDb(
      {
        nodes: [nodeRow(IMAGE_NODE, 'image', { prompt: 'x', model: MODEL, references: [{ source: 'catalogue', id: CATALOGUE_ID }] })],
        nodes_connections: [],
        assets: [],
        reference_images: []
      }
    );

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: MODEL, medium: 'image' });

    expect(out.pickedImageUrls).toEqual([]);
    expect(out.blocked).toBeNull();
  });
});

describe('upstreamInputsFor — le porte nominate di un select: ogni filo porta SOLO il valore della sua porta', () => {
  const productRows = [
    { id: 'pr1', org_id: ORG, node_id: PRODUCTS_NODE, project_id: 'p1', platform: 'shopify', external_id: '1', handle: 'tree', title: 'Tree Runner', description: 'Light', price: 98, currency: 'USD', url: null, images: [{ url: 'canvas-assets/t1.png' }, { url: 'canvas-assets/t2.png' }], available: true, synced_at: 'now', created_at: 'now' },
    { id: 'pr2', org_id: ORG, node_id: PRODUCTS_NODE, project_id: 'p1', platform: 'shopify', external_id: '2', handle: 'wool', title: 'Wool Runner', description: 'Warm', price: 110, currency: 'USD', url: null, images: [{ url: 'canvas-assets/w1.png' }], available: true, synced_at: 'now', created_at: 'now' }
  ];

  const feedRow = (id: string, caption: string, likes: number) => ({
    id,
    org_id: ORG,
    node_id: FEED_NODE,
    project_id: 'p1',
    platform: 'instagram',
    external_id: id,
    handle: 'nike',
    caption,
    media: { items: [{ type: 'image', url: `canvas-assets/${id}.png` }] },
    metrics: { likes },
    permalink: null,
    posted_at: 'now',
    fetched_at: 'now'
  });

  function productsCanvas(outputs: unknown[], handle: string, target: { id: string; type: string; data: Record<string, unknown> }) {
    return fakeDb({
      nodes: [
        nodeRow(PRODUCTS_NODE, 'products', { type: 'shopify', url: 'https://x.myshopify.com' }),
        nodeRow(SELECT_NODE, 'select', { index: 1, outputs }),
        nodeRow(target.id, target.type, target.data)
      ],
      nodes_connections: [
        { id: 'e-products-select', canvas_id: CANVAS, source_node_id: PRODUCTS_NODE, target_node_id: SELECT_NODE, source_handle: null, target_handle: null },
        { id: 'e-select-target', canvas_id: CANVAS, source_node_id: SELECT_NODE, target_node_id: target.id, source_handle: handle, target_handle: null }
      ],
      products: productRows,
      assets: []
    }).db;
  }

  it('price → un nodo testo riceve solo il prezzo', async () => {
    const db = productsCanvas([{ id: 'o1', field: 'price' }], 'out:field:price', { id: TEXT_NODE, type: 'text', data: { prompt: '' } });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: TEXT_NODE, model: 'openai/gpt-5', medium: 'text' });

    expect(out.text).toEqual(['98']);
    expect(out.referenceImageUrls).toEqual([]);
  });

  it('first_image → un nodo immagine riceve una foto sola', async () => {
    const db = productsCanvas([{ id: 'o1', field: 'first_image' }], 'out:field:first_image', { id: IMAGE_NODE, type: 'image', data: { prompt: '', model: 'qwen3-pro' } });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: IMAGE_NODE, model: 'qwen3-pro', medium: 'image' });

    expect(out.referenceImageUrls).toEqual(['canvas-assets/t1.png']);
    expect(out.text).toEqual([]);
  });

  it('images → tutte le foto, e nessun testo', async () => {
    const db = productsCanvas([], 'out:images', { id: VIDEO_NODE, type: 'video', data: { prompt: '', model: MODEL } });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: VIDEO_NODE, model: MODEL, medium: 'video' });

    expect(out.referenceImageUrls).toEqual(['canvas-assets/t1.png', 'canvas-assets/t2.png']);
    expect(out.text).toEqual([]);
  });

  it('text da un feed → la didascalia', async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(FEED_NODE, 'social_account_feed', { platform: 'instagram', handle: 'nike' }),
        nodeRow(SELECT_NODE, 'select', { index: 1 }),
        nodeRow(TEXT_NODE, 'text', { prompt: '' })
      ],
      nodes_connections: [
        { id: 'e-feed-select', canvas_id: CANVAS, source_node_id: FEED_NODE, target_node_id: SELECT_NODE, source_handle: null, target_handle: null },
        { id: 'e-select-text', canvas_id: CANVAS, source_node_id: SELECT_NODE, target_node_id: TEXT_NODE, source_handle: 'out:text', target_handle: null }
      ],
      social_posts: [feedRow('sp1', 'Just do it', 10)],
      assets: []
    });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: TEXT_NODE, model: 'openai/gpt-5', medium: 'text' });

    expect(out.text).toEqual(['Just do it']);
  });

  it('una porta segnalata (campo che la sorgente non ha) è rifiutata, non un valore a caso', async () => {
    const db = productsCanvas([{ id: 'o1', field: 'likes' }], 'out:field:likes', { id: TEXT_NODE, type: 'text', data: { prompt: '' } });

    const out = await upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: TEXT_NODE, model: 'openai/gpt-5', medium: 'text' });

    expect(out.text).toEqual([]);
    expect(out.rejected).toEqual([{ nodeId: SELECT_NODE, why: expect.stringContaining('out:field:likes') }]);
  });

  it("in un loop sul feed il select segue l'iterazione, con lo stesso campo", async () => {
    const { db } = fakeDb({
      nodes: [
        nodeRow(FEED_NODE, 'social_account_feed', { platform: 'instagram', handle: 'nike' }),
        nodeRow(SELECT_NODE, 'select', { index: 1, outputs: [{ id: 'o1', field: 'likes' }] }),
        nodeRow(TEXT_NODE, 'text', { prompt: '' })
      ],
      nodes_connections: [
        { id: 'e-feed-select', canvas_id: CANVAS, source_node_id: FEED_NODE, target_node_id: SELECT_NODE, source_handle: null, target_handle: null },
        { id: 'e-select-text', canvas_id: CANVAS, source_node_id: SELECT_NODE, target_node_id: TEXT_NODE, source_handle: 'out:field:likes', target_handle: null }
      ],
      social_posts: [feedRow('sp1', 'one', 10), feedRow('sp2', 'two', 20)],
      assets: []
    });

    const out = await upstreamInputsFor(db, {
      orgId: ORG,
      canvasId: CANVAS,
      nodeId: TEXT_NODE,
      model: 'openai/gpt-5',
      medium: 'text',
      iterateSelection: { [FEED_NODE]: 2 }
    });

    expect(out.text).toEqual(['20']);
  });
});

describe('upstreamInputsFor — a dubbed video node gives video and its track on separate handles', () => {
  const DUB_NODE = '12121212-1212-1212-1212-121212121212';
  const TRACK_ASSET = '13131313-1313-1313-1313-131313131313';
  const asset = (id: string, type: string, url: string, mime: string) => ({
    id, project_id: 'p1', type, url, content: null, mime_type: mime, bytes: null, width: null, height: null,
    duration_s: 5, source: 'generated', source_node_id: DUB_NODE, created_at: 'now'
  });
  const wire = (id: string, sourceHandle: string | null) => ({
    id, canvas_id: CANVAS, source_node_id: DUB_NODE, target_node_id: VIDEO_NODE, source_handle: sourceHandle, target_handle: null
  });
  const dubDb = (edges: ReturnType<typeof wire>[]) =>
    fakeDb({
      nodes: [
        nodeRow(DUB_NODE, 'audio', {
          prompt: '',
          params: { operation: 'dubbing', targetLanguage: 'it' },
          refId: VIDEO_ASSET,
          outputRefs: { videos: VIDEO_ASSET, audios: TRACK_ASSET }
        }),
        nodeRow(VIDEO_NODE, 'video', { prompt: '', model: MODEL })
      ],
      nodes_connections: edges,
      assets: [asset(VIDEO_ASSET, 'video', 'https://cdn/dubbed.mp4', 'video/mp4'), asset(TRACK_ASSET, 'audio', 'https://cdn/track.mp3', 'audio/mpeg')]
    });

  const resolve = (db: ReturnType<typeof dubDb>['db']) =>
    upstreamInputsFor(db, { orgId: ORG, canvasId: CANVAS, nodeId: VIDEO_NODE, model: MODEL, medium: 'video' });

  it('out:videos feeds the dubbed video, out:audios its track', async () => {
    const out = await resolve(dubDb([wire('e1', 'out:videos'), wire('e2', 'out:audios')]).db);

    expect(out.referenceVideoUrls).toEqual(['https://cdn/dubbed.mp4']);
    expect(out.referenceAudioUrls).toEqual(['https://cdn/track.mp3']);
  });

  it('an edge drawn before the outputs existed feeds the dubbed video as video, not as audio', async () => {
    const out = await resolve(dubDb([wire('e1', null)]).db);

    expect(out.referenceVideoUrls).toEqual(['https://cdn/dubbed.mp4']);
    expect(out.referenceAudioUrls).toEqual([]);
  });
});
