import { ProjectMode } from '$lib/project-mode';
import { describe, expect, it, vi } from 'vitest';
import { Provenance } from './likeness-guard';
import { startWiroRun, WIRO_REFUSALS, type WiroModel, type WiroRunDeps, type WiroRequest } from './wiro-run';

const SCOPE = { orgId: 'org-1', projectId: 'p1', canvasId: 'c1', nodeId: 'n1', userId: 'u1' };

const uncensoredModel: WiroModel = {
  id: 'wiro/uncensored-image',
  catalogue: 'image',
  spec: { owner: 'wiro-owner', project: 'uncensored-image', fields: { prompt: 'prompt', images: ['image_1'] } },
  uncensored: true,
  paramSchema: {}
};

function depsFor(model: WiroModel | null): { deps: WiroRunDeps; gatewayRun: ReturnType<typeof vi.fn> } {
  const gatewayRun = vi.fn().mockResolvedValue({ taskId: 'job-1' });
  const deps: WiroRunDeps = {
    gateway: { run: gatewayRun, task: vi.fn(), purge: vi.fn() },
    model: async () => model,
    access: async () => ({ allowed: true }),
    screen: () => ({
      decide: async () => ({ choice: 'safe', probabilities: { safe: 1 } }),
      judge: async () => ({ allowed: true, category: 'none', reason: '' }),
      decideIdentifiability: async () => ({ choice: 'generic', probabilities: { generic: 1 } }),
      judgeIdentifiability: async () => ({ allowed: true, category: 'generic', reason: '' }),
      record: () => {}
    }),
    refuseLikeness: vi.fn(),
    bill: vi.fn()
  };
  return { deps, gatewayRun };
}

const baseRequest: Omit<WiroRequest, 'scope' | 'modelId'> = {
  mode: ProjectMode.Uncensored,
  prompt: 'a picture',
  params: {},
  imageUrls: [],
  lastFrameUrl: null,
  provenance: []
};

describe('startWiroRun — un modello uncensored non porta MAI ingressi al provider', () => {
  it('un giro con immagini di riferimento verso un modello uncensored si rifiuta PRIMA di chiamare Wiro', async () => {
    const { deps, gatewayRun } = depsFor(uncensoredModel);

    const out = await startWiroRun(deps, {
      ...baseRequest,
      scope: SCOPE,
      modelId: uncensoredModel.id,
      imageUrls: ['https://example.com/ref.png']
    });

    expect(out).toEqual({ kind: 'refused', error: WIRO_REFUSALS.noInputsAllowed });
    expect(gatewayRun).not.toHaveBeenCalled();
  });

  it('un lastFrameUrl verso un modello uncensored si rifiuta anche da solo', async () => {
    const { deps, gatewayRun } = depsFor(uncensoredModel);

    const out = await startWiroRun(deps, {
      ...baseRequest,
      scope: SCOPE,
      modelId: uncensoredModel.id,
      lastFrameUrl: 'https://example.com/last.png'
    });

    expect(out).toEqual({ kind: 'refused', error: WIRO_REFUSALS.noInputsAllowed });
    expect(gatewayRun).not.toHaveBeenCalled();
  });

  it('provenance non vuota verso un modello uncensored si rifiuta anche senza url immagine', async () => {
    const { deps, gatewayRun } = depsFor(uncensoredModel);

    const out = await startWiroRun(deps, {
      ...baseRequest,
      scope: SCOPE,
      modelId: uncensoredModel.id,
      provenance: [{ kind: 'generated_media', label: 'a media' } as WiroRequest['provenance'][number]]
    });

    expect(out).toEqual({ kind: 'refused', error: WIRO_REFUSALS.noInputsAllowed });
    expect(gatewayRun).not.toHaveBeenCalled();
  });

  it('un giro senza nessun ingresso, verso un modello uncensored, procede normalmente', async () => {
    const { deps, gatewayRun } = depsFor(uncensoredModel);

    const out = await startWiroRun(deps, { ...baseRequest, scope: SCOPE, modelId: uncensoredModel.id });

    expect(out).toEqual({ kind: 'job', jobId: expect.stringContaining('job-1') });
    expect(gatewayRun).toHaveBeenCalledTimes(1);
  });

  it('un modello NON uncensored porta i suoi riferimenti come sempre, senza il rifiuto nuovo', async () => {
    const censoredModel: WiroModel = { ...uncensoredModel, id: 'wiro/sfw-image', uncensored: false };
    const { deps, gatewayRun } = depsFor(censoredModel);

    const out = await startWiroRun(deps, {
      ...baseRequest,
      scope: SCOPE,
      modelId: censoredModel.id,
      imageUrls: ['https://example.com/ref.png']
    });

    expect(out.kind).toBe('job');
    expect(gatewayRun).toHaveBeenCalledTimes(1);
  });
});

const model3d: WiroModel = {
  id: 'wiro/microsoft/trellis-2',
  catalogue: 'model3d',
  spec: { owner: 'microsoft', project: 'trellis-2', fields: { images: ['inputImage'] } },
  uncensored: false,
  paramSchema: { pipeline_type: { type: 'enum', values: ['512'] } }
};

describe('startWiroRun — a 3D model', () => {
  it('sends only the image and its own params: the tool has no prompt field', async () => {
    const { deps, gatewayRun } = depsFor(model3d);

    await startWiroRun(deps, {
      ...baseRequest,
      mode: ProjectMode.Standard,
      scope: SCOPE,
      modelId: model3d.id,
      params: { pipeline_type: '512' } as WiroRequest['params'],
      imageUrls: ['https://example.com/product.png']
    });

    expect(gatewayRun).toHaveBeenCalledWith(
      { owner: 'microsoft', project: 'trellis-2' },
      { inputImage: 'https://example.com/product.png', pipeline_type: '512' }
    );
  });

  it('in an uncensored project refuses an uploaded reference, which may show a real person', async () => {
    const { deps, gatewayRun } = depsFor(model3d);

    const out = await startWiroRun(deps, {
      ...baseRequest,
      scope: SCOPE,
      modelId: model3d.id,
      imageUrls: ['https://example.com/upload.png'],
      provenance: [{ kind: Provenance.UploadedMedia, label: 'upload' }]
    });

    expect(out.kind).toBe('refused');
    expect(gatewayRun).not.toHaveBeenCalled();
  });

  it('in an uncensored project accepts a generated reference', async () => {
    const { deps, gatewayRun } = depsFor(model3d);

    const out = await startWiroRun(deps, {
      ...baseRequest,
      scope: SCOPE,
      modelId: model3d.id,
      imageUrls: ['https://example.com/gen.png'],
      provenance: [{ kind: Provenance.GeneratedMedia, label: 'gen' }]
    });

    expect(out.kind).toBe('job');
    expect(gatewayRun).toHaveBeenCalledTimes(1);
  });
});
