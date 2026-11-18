import { describe, it, expect, vi, beforeEach } from 'vitest';

const signKnowledgePaths = vi.fn();
const withOrgContext = vi.fn();
const submitAndTrackVideoRender = vi.fn();
const imagePartFor = vi.fn();

const SIGNED = 'https://storage.test/signed?token=abc';

vi.mock('$lib/server/image-part', () => ({
  imagePartFor: (...args: unknown[]) => imagePartFor(...args)
}));
vi.mock('$lib/server/media-archive', () => ({
  signKnowledgePaths: (...args: unknown[]) => signKnowledgePaths(...args)
}));
vi.mock('$lib/server/content-credentials', () => ({
  markGenerated: async (bytes: Buffer) => ({ bytes, marked: true }),
  DIGITAL_SOURCE_TYPE: { synthetic: 'trainedAlgorithmicMedia' }
}));
vi.mock('$lib/server/ai-log', () => ({
  billedUsdInScope: () => 0.05,
  withOrgContext: <T>(orgId: string, fn: () => T) => {
    withOrgContext(orgId);
    return fn();
  }
}));
vi.mock('$lib/server/video-render-queue', () => ({
  submitAndTrackVideoRender: (...args: unknown[]) => submitAndTrackVideoRender(...args)
}));
vi.mock('$lib/server/video', () => ({
  resolveVideoModel: () => 'bytedance/seedance-2-5',
  clampVideoDuration: (d: number) => d
}));
vi.mock('$lib/server/supabase-admin', () => ({ createAdminClient: () => adminClient }));

import { generateVideoWithoutBrand } from './media-generate';

function adminForVideo() {
  return {
    from: (table: string) => {
      if (table !== 'video_renders') throw new Error(`ha letto ${table}`);
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'job-1' }, error: null }) }) })
      };
    }
  } as never;
}

let adminClient: unknown = adminForVideo();

const ORG = 'org-1';
const USER = 'user-1';
const OWN_IMAGE = `${USER}/media/generated-a1.png`;
const SOMEONE_ELSE = 'user-2/media/generated-a1.png';

beforeEach(() => {
  vi.clearAllMocks();
  adminClient = adminForVideo();
  signKnowledgePaths.mockImplementation(
    async (_c: unknown, paths: string[]) => new Map(paths.map((p) => [p, SIGNED]))
  );
  imagePartFor.mockResolvedValue({ ok: true, part: { inlineData: { mimeType: 'image/png', data: 'AAAA' } } });
  submitAndTrackVideoRender.mockResolvedValue({
    taskId: 'task-1',
    jobId: 'job-1',
    model: 'bytedance/seedance-2-5',
    durationSeconds: 8
  });
});

describe('un video', () => {
  const job = { orgId: ORG, userId: USER, prompt: 'un gatto che salta' };

  it('addebita all organizzazione, che è chi paga', async () => {
    await generateVideoWithoutBrand(job);

    expect(withOrgContext).toHaveBeenCalledWith(ORG);
  });

  it('scrive l organizzazione sulla riga della coda', async () => {
    await generateVideoWithoutBrand(job);

    expect(submitAndTrackVideoRender).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: ORG })
    );
  });

  it('anima il percorso che il generatore ha consegnato', async () => {
    await generateVideoWithoutBrand({ ...job, baseMediaId: OWN_IMAGE });

    expect(submitAndTrackVideoRender).toHaveBeenCalledWith(
      expect.objectContaining({ render: expect.objectContaining({ imageUrl: SIGNED }) })
    );
  });

  it('il percorso di un altro utente non risolve, e il render non parte', async () => {
    const out = await generateVideoWithoutBrand({ ...job, baseMediaId: SOMEONE_ELSE });

    expect(out).toMatchObject({ ok: false, error: 'source_not_found' });
    expect(submitAndTrackVideoRender).not.toHaveBeenCalled();
  });

  it('un indirizzo scelto da chi chiama non è una sorgente', async () => {
    const out = await generateVideoWithoutBrand({ ...job, baseMediaId: 'https://evil.test/a.png' });

    expect(out).toMatchObject({ ok: false, error: 'source_not_found' });
    expect(submitAndTrackVideoRender).not.toHaveBeenCalled();
  });

  it('torna un job da seguire, perché un clip non è mai pronto subito', async () => {
    const out = await generateVideoWithoutBrand(job);

    expect(out.ok && out.status).toBe('rendering');
    expect(out.ok && out.jobId).toBeTruthy();
  });
});
