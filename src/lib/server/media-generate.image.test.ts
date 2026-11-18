import { describe, it, expect, vi, beforeEach } from 'vitest';

const renderPostImage = vi.fn();
const upload = vi.fn();
const signKnowledgePaths = vi.fn();
const withOrgContext = vi.fn();
const markGenerated = vi.fn();

const PNG_DATA_URL = 'data:image/png;base64,AAAA';

let billedUsd: number | undefined;

vi.mock('$lib/server/media-generate.images', () => ({
  renderPostImage: (...args: unknown[]) => renderPostImage(...args),
  buildImageRequest: (_prompt: string, opts: { model?: string }) => ({ model: opts.model ?? null })
}));
vi.mock('$lib/server/media-archive', () => ({
  signKnowledgePaths: (...args: unknown[]) => signKnowledgePaths(...args)
}));
vi.mock('$lib/server/content-credentials', () => ({
  markGenerated: (...args: unknown[]) => markGenerated(...args),
  DIGITAL_SOURCE_TYPE: { synthetic: 'trainedAlgorithmicMedia' }
}));
vi.mock('$lib/server/ai-log', () => ({
  billedUsdInScope: () => billedUsd,
  withOrgContext: <T>(orgId: string, fn: () => T) => {
    withOrgContext(orgId);
    return fn();
  }
}));

import { generateImagesWithoutBrand } from './media-generate';

const SIGNED = 'https://storage.test/signed?token=abc';

const db = {
  storage: { from: (bucket: string) => ({ upload: (...args: unknown[]) => upload(bucket, ...args) }) }
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  billedUsd = 0.0336;
  renderPostImage.mockResolvedValue(PNG_DATA_URL);
  markGenerated.mockImplementation(async (bytes: Buffer) => ({ bytes, marked: true }));
  upload.mockResolvedValue({ error: null });
  signKnowledgePaths.mockImplementation(async (_c: unknown, paths: string[]) => new Map(paths.map((p) => [p, SIGNED])));
});

describe('disegnare un\'immagine', () => {
  const job = { orgId: 'org-1', userId: 'user-1', prompt: 'un gatto' };

  it('addebita all organizzazione, che è chi paga', async () => {
    await generateImagesWithoutBrand(db, job);

    expect(withOrgContext).toHaveBeenCalledWith('org-1');
  });

  it('non ha un id: il file si ritrova dal percorso', async () => {
    const out = await generateImagesWithoutBrand(db, job);

    expect(out.ok && out.media[0].id).toBeNull();
  });

  it('il file sta sotto lo user, dove la policy dello storage lo trova', async () => {
    await generateImagesWithoutBrand(db, job);

    const [, path] = upload.mock.calls[0];
    expect(String(path).split('/')[0]).toBe('user-1');
  });

  it('torna un link firmato e il percorso, perché non c è un id con cui ritrovarlo', async () => {
    const out = await generateImagesWithoutBrand(db, job);

    expect(out.ok && out.media[0].url).toBe(SIGNED);
    expect(out.ok && out.media[0].storage_path).toMatch(/^user-1\/media\//);
  });

  it('marca il disegno col modello che lo ha fatto, e dice se la marcatura è riuscita', async () => {
    markGenerated.mockImplementation(async (bytes: Buffer) => ({ bytes, marked: false }));

    const out = await generateImagesWithoutBrand(db, job);

    expect(markGenerated).toHaveBeenCalledWith(expect.any(Buffer), 'image/png', { model: out.ok && out.model, provider: 'openrouter' });
    expect(out.ok && out.media[0].ai_marked).toBe(false);
    expect(upload).toHaveBeenCalled();
  });

  it('più alternative, più render pagati, e il conto lo dice', async () => {
    const out = await generateImagesWithoutBrand(db, { ...job, count: 3 });

    expect(renderPostImage).toHaveBeenCalledTimes(3);
    expect(out.ok && out.renders).toBe(3);
  });

  it('dice quanto è costato leggendolo dalle righe, non da un listino accanto', async () => {
    const out = await generateImagesWithoutBrand(db, job);

    expect(out.ok && out.costUsd).toBe(0.0336);
  });

  it('una fattura che non è arrivata resta sconosciuta, non zero', async () => {
    billedUsd = undefined;

    const out = await generateImagesWithoutBrand(db, job);

    expect(out.ok && out.costUsd).toBeNull();
  });

  it('una firma che non arriva è un fallimento, non una url nulla', async () => {
    signKnowledgePaths.mockResolvedValue(new Map());

    const out = await generateImagesWithoutBrand(db, job);

    expect(out).toMatchObject({ ok: false, error: 'store_failed' });
  });

  it('un bucket assente porta il SUO motivo, non il token generico e basta', async () => {
    upload.mockResolvedValue({ error: { message: 'Bucket not found' } });

    const out = await generateImagesWithoutBrand(db, job);

    expect(out).toMatchObject({ ok: false, error: 'store_failed', reason: 'Bucket not found' });
  });

  it('un render che non torna niente è un fallimento, non un successo vuoto', async () => {
    renderPostImage.mockResolvedValue(undefined);

    const out = await generateImagesWithoutBrand(db, job);

    expect(out).toEqual({ ok: false, error: 'render_failed' });
  });
});

