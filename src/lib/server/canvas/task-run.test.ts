import { ProjectMode } from '$lib/project-mode';
import { describe, expect, it, vi } from 'vitest';
import { Provenance } from './likeness-guard';
import { ProviderBusyError } from './task-provider';
import { finishTaskJob, QueuePlace, RefusalStage, startTaskRun, TASK_REFUSALS, TASK_TIMED_OUT, type TaskModel, type TaskRunDeps, type TaskRequest } from './task-run';

const SCOPE = { orgId: 'org-1', projectId: 'p1', canvasId: 'c1', nodeId: 'n1', userId: 'u1' };

const uncensoredModel: TaskModel = {
  id: 'wiro/uncensored-image',
  catalogue: 'image',
  spec: { owner: 'wiro-owner', project: 'uncensored-image', fields: { prompt: 'prompt', images: ['image_1'] } },
  uncensored: true,
  paramSchema: {}
};

function depsFor(model: TaskModel | null): { deps: TaskRunDeps; gatewayRun: ReturnType<typeof vi.fn> } {
  const gatewayRun = vi.fn().mockResolvedValue({ taskId: 'job-1' });
  const deps: TaskRunDeps = {
    providers: { wiro: { run: gatewayRun, task: vi.fn(), purge: vi.fn() } },
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

const baseRequest: Omit<TaskRequest, 'scope' | 'modelId'> = {
  mode: ProjectMode.Uncensored,
  prompt: 'a picture',
  params: {},
  imageUrls: [],
  lastFrameUrl: null,
  provenance: []
};

describe('startTaskRun — un modello uncensored non porta MAI ingressi al provider', () => {
  it('un giro con immagini di riferimento verso un modello uncensored si rifiuta PRIMA di chiamare Wiro', async () => {
    const { deps, gatewayRun } = depsFor(uncensoredModel);

    const out = await startTaskRun(deps, {
      ...baseRequest,
      scope: SCOPE,
      modelId: uncensoredModel.id,
      imageUrls: ['https://example.com/ref.png']
    });

    expect(out).toEqual({ kind: 'refused', error: TASK_REFUSALS.noInputsAllowed, stage: RefusalStage.Policy });
    expect(gatewayRun).not.toHaveBeenCalled();
  });

  it('un lastFrameUrl verso un modello uncensored si rifiuta anche da solo', async () => {
    const { deps, gatewayRun } = depsFor(uncensoredModel);

    const out = await startTaskRun(deps, {
      ...baseRequest,
      scope: SCOPE,
      modelId: uncensoredModel.id,
      lastFrameUrl: 'https://example.com/last.png'
    });

    expect(out).toEqual({ kind: 'refused', error: TASK_REFUSALS.noInputsAllowed, stage: RefusalStage.Policy });
    expect(gatewayRun).not.toHaveBeenCalled();
  });

  it('provenance non vuota verso un modello uncensored si rifiuta anche senza url immagine', async () => {
    const { deps, gatewayRun } = depsFor(uncensoredModel);

    const out = await startTaskRun(deps, {
      ...baseRequest,
      scope: SCOPE,
      modelId: uncensoredModel.id,
      provenance: [{ kind: 'generated_media', label: 'a media' } as TaskRequest['provenance'][number]]
    });

    expect(out).toEqual({ kind: 'refused', error: TASK_REFUSALS.noInputsAllowed, stage: RefusalStage.Policy });
    expect(gatewayRun).not.toHaveBeenCalled();
  });

  it('un giro senza nessun ingresso, verso un modello uncensored, procede normalmente', async () => {
    const { deps, gatewayRun } = depsFor(uncensoredModel);

    const out = await startTaskRun(deps, { ...baseRequest, scope: SCOPE, modelId: uncensoredModel.id });

    expect(out).toEqual({ kind: 'job', jobId: expect.stringContaining('job-1') });
    expect(gatewayRun).toHaveBeenCalledTimes(1);
  });

  it('un modello NON uncensored porta i suoi riferimenti come sempre, senza il rifiuto nuovo', async () => {
    const censoredModel: TaskModel = { ...uncensoredModel, id: 'wiro/sfw-image', uncensored: false };
    const { deps, gatewayRun } = depsFor(censoredModel);

    const out = await startTaskRun(deps, {
      ...baseRequest,
      scope: SCOPE,
      modelId: censoredModel.id,
      imageUrls: ['https://example.com/ref.png']
    });

    expect(out.kind).toBe('job');
    expect(gatewayRun).toHaveBeenCalledTimes(1);
  });
});

const model3d: TaskModel = {
  id: 'wiro/microsoft/trellis-2',
  catalogue: 'model3d',
  spec: { owner: 'microsoft', project: 'trellis-2', fields: { images: ['inputImage'] } },
  uncensored: false,
  paramSchema: { pipeline_type: { type: 'enum', values: ['512'] } }
};

describe('startTaskRun — a 3D model', () => {
  it('sends only the image and its own params: the tool has no prompt field', async () => {
    const { deps, gatewayRun } = depsFor(model3d);

    await startTaskRun(deps, {
      ...baseRequest,
      mode: ProjectMode.Standard,
      scope: SCOPE,
      modelId: model3d.id,
      params: { pipeline_type: '512' } as TaskRequest['params'],
      imageUrls: ['https://example.com/product.png']
    });

    expect(gatewayRun).toHaveBeenCalledWith(
      { owner: 'microsoft', project: 'trellis-2' },
      { inputImage: 'https://example.com/product.png', pipeline_type: '512' },
      undefined
    );
  });

  it('in an uncensored project refuses an uploaded reference, which may show a real person', async () => {
    const { deps, gatewayRun } = depsFor(model3d);

    const out = await startTaskRun(deps, {
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

    const out = await startTaskRun(deps, {
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

describe('an image-only 3D run in a standard project', () => {
  const trellis: TaskModel = {
    id: 'wiro/microsoft/trellis-2',
    catalogue: 'model3d',
    spec: { owner: 'microsoft', project: 'trellis-2', fields: { images: ['inputImage'] } },
    uncensored: false,
    paramSchema: {}
  };

  it('is not refused by a judge that cannot see the reference', async () => {
    const { deps, gatewayRun } = depsFor(trellis);
    const doubting = deps.screen(SCOPE, trellis);
    deps.screen = () => ({
      ...doubting,
      decide: async () => ({ choice: 'safe', probabilities: { safe: 0.9, hate: 0.05 } }),
      judge: async () => ({ allowed: false, category: 'adult_sexual', reason: 'attached reference media cannot be inspected' })
    });

    const out = await startTaskRun(deps, {
      ...baseRequest,
      mode: ProjectMode.Standard,
      prompt: '',
      scope: SCOPE,
      modelId: trellis.id,
      imageUrls: ['https://example.com/product.png'],
      provenance: [{ kind: Provenance.UploadedMedia, label: 'product.png' }]
    });

    expect(out).toEqual({ kind: 'job', jobId: 'wiro:job-1' });
    expect(gatewayRun).toHaveBeenCalledTimes(1);
  });
});

const kieBanana: TaskModel = {
  id: 'kie/nano-banana-2',
  catalogue: 'image',
  spec: { model: 'nano-banana-2', fields: { prompt: 'prompt', resolution: 'resolution', images: [], imageList: 'image_input' } },
  uncensored: false,
  paramSchema: {},
  pricing: { lines: [{ inputs: { resolution: '1K' }, usd: 0.04, method: 'cpr' }] }
};

describe('startTaskRun — one port, several providers', () => {
  it('sends a kie model to the kie adapter and tags the job with its provider', async () => {
    const { deps } = depsFor(kieBanana);
    const kieRun = vi.fn().mockResolvedValue({ taskId: 'task_42' });
    deps.providers = { kie: { run: kieRun, task: vi.fn() } };

    const out = await startTaskRun(deps, {
      ...baseRequest,
      mode: ProjectMode.Standard,
      scope: SCOPE,
      modelId: kieBanana.id,
      params: { resolution: '1K' },
      imageUrls: ['https://example.com/a.png', 'https://example.com/b.png'],
      idempotencyKey: 'run-1'
    });

    expect(out).toEqual({ kind: 'job', jobId: 'kie:task_42' });
    expect(kieRun).toHaveBeenCalledWith(
      { model: 'nano-banana-2' },
      { prompt: 'a picture', resolution: '1K', image_input: ['https://example.com/a.png', 'https://example.com/b.png'] },
      'run-1'
    );
  });

  it('refuses at the provider stage when that provider has no key, so routing may fall back', async () => {
    const { deps } = depsFor(kieBanana);
    deps.providers = {};

    const out = await startTaskRun(deps, { ...baseRequest, mode: ProjectMode.Standard, scope: SCOPE, modelId: kieBanana.id });

    expect(out).toEqual({ kind: 'refused', error: TASK_REFUSALS.notConfigured, stage: RefusalStage.Provider });
  });

  it('bills a submit that throws as a failed attempt at the quoted price, refused at the provider stage', async () => {
    const { deps } = depsFor(kieBanana);
    deps.providers = { kie: { run: vi.fn().mockRejectedValue(new Error('kie_failed: HTTP 500')), task: vi.fn() } };

    const out = await startTaskRun(deps, { ...baseRequest, mode: ProjectMode.Standard, scope: SCOPE, modelId: kieBanana.id, params: { resolution: '1K' } });

    expect(out).toEqual({ kind: 'refused', error: 'kie_failed: HTTP 500', stage: RefusalStage.Provider });
    expect(deps.bill).toHaveBeenCalledWith(expect.objectContaining({ provider: 'kie', costUsd: null, quotedUsd: 0.04, error: 'kie_failed: HTTP 500' }));
  });

  it('refuses an uncensored model in a standard project before any provider is called, whoever serves it', async () => {
    const uncensoredKie: TaskModel = { ...kieBanana, id: 'kie/uncensored', uncensored: true };
    const { deps } = depsFor(uncensoredKie);
    const kieRun = vi.fn();
    deps.providers = { kie: { run: kieRun, task: vi.fn() } };

    const out = await startTaskRun(deps, { ...baseRequest, mode: ProjectMode.Standard, scope: SCOPE, modelId: uncensoredKie.id });

    expect(out).toEqual({ kind: 'refused', error: 'uncensored_requires_uncensored_project', stage: RefusalStage.Policy });
    expect(kieRun).not.toHaveBeenCalled();
  });
});

describe('finishTaskJob — what a finished, failed or abandoned task bills', () => {
  const STARTED = '2026-10-15T10:00:00.000Z';
  const job = { externalJobId: 'kie:task_42', modelId: kieBanana.id, scope: SCOPE, mode: ProjectMode.Standard, params: { resolution: '1K' }, startedAt: STARTED };

  it('gives up on a discount task that outlived its window, cancels it if it can, and bills nothing', async () => {
    const bill = vi.fn();
    const cancel = vi.fn().mockResolvedValue(false);
    const providers = { kie: { run: vi.fn(), task: vi.fn().mockResolvedValue({ state: 'pending' }), cancel } };

    const out = await finishTaskJob({} as never, { providers, model: async () => kieBanana, bill }, { ...job, now: Date.parse(STARTED) + 4 * 60_000 });

    expect(out).toEqual({ state: 'failed', error: TASK_TIMED_OUT });
    expect(cancel).toHaveBeenCalledWith('task_42');
    expect(bill).toHaveBeenCalledWith(expect.objectContaining({ provider: 'kie', costUsd: null, error: TASK_TIMED_OUT }));
  });

  it('keeps waiting on a discount task still inside its window', async () => {
    const providers = { kie: { run: vi.fn(), task: vi.fn().mockResolvedValue({ state: 'pending' }) } };

    const out = await finishTaskJob({} as never, { providers, model: async () => kieBanana, bill: vi.fn() }, { ...job, now: Date.parse(STARTED) + 60_000 });

    expect(out).toEqual({ state: 'pending' });
  });
});

describe('startTaskRun — a request the provider would refuse never leaves', () => {
  const editModel: TaskModel = {
    id: 'wiro/fireredteam/firered-image-edit',
    catalogue: 'image',
    spec: { owner: 'fireredteam', project: 'firered-image-edit', fields: { prompt: 'prompt', images: ['inputImage'] }, requiresImage: true },
    uncensored: false,
    paramSchema: {}
  };

  it('refuses a model that needs an input image when the node has none', async () => {
    const { deps, gatewayRun } = depsFor(editModel);

    const out = await startTaskRun(deps, { ...baseRequest, mode: ProjectMode.Standard, scope: SCOPE, modelId: editModel.id });

    expect(out).toEqual({ kind: 'refused', error: TASK_REFUSALS.needsImage, stage: RefusalStage.Policy });
    expect(gatewayRun).not.toHaveBeenCalled();
  });

  it('refuses a model the catalogue marked unrunnable', async () => {
    const model: TaskModel = { ...editModel, spec: { owner: 'o', project: 'p', fields: { prompt: 'prompt', images: [] }, unrunnable: 'required_field_without_default' } };
    const { deps, gatewayRun } = depsFor(model);

    const out = await startTaskRun(deps, { ...baseRequest, mode: ProjectMode.Standard, scope: SCOPE, modelId: model.id });

    expect(out.kind).toBe('refused');
    expect(gatewayRun).not.toHaveBeenCalled();
  });

  it('sends required defaults and drops a stale aspect the model does not take', async () => {
    const model: TaskModel = {
      ...editModel,
      spec: { owner: 'o', project: 'p', fields: { prompt: 'prompt', aspectRatio: 'ratio', images: [] }, fixed: { ratio: '1:1', size: '1K' } },
      paramSchema: { aspect_ratio: { type: 'enum', values: ['1:1', '16:9'] } }
    };
    const { deps, gatewayRun } = depsFor(model);

    await startTaskRun(deps, { ...baseRequest, mode: ProjectMode.Standard, scope: SCOPE, modelId: model.id, params: { aspectRatio: '21:9' } });

    expect(gatewayRun.mock.calls[0][0]).toEqual({ owner: 'o', project: 'p' });
    expect(gatewayRun.mock.calls[0][1]).toEqual({ prompt: 'a picture', ratio: '1:1', size: '1K' });
  });
});

const referenceVideo: TaskModel = {
  id: 'higgsfield/bytedance/seedance-2.5/reference-to-video',
  catalogue: 'video',
  spec: { path: 'bytedance/seedance-2.5/reference-to-video', fields: { prompt: 'prompt', images: [], videoList: 'video_urls', audioList: 'audio_urls' }, caps: { video: 10 } },
  uncensored: false,
  paramSchema: {}
};

describe('startTaskRun — video and audio references', () => {
  it('sends upstream videos and audios to the model, and nothing but the path as its ref', async () => {
    const { deps, gatewayRun } = depsFor(referenceVideo);
    deps.providers = { higgsfield: deps.providers.wiro };

    await startTaskRun(deps, {
      ...baseRequest,
      mode: ProjectMode.Standard,
      scope: SCOPE,
      modelId: referenceVideo.id,
      videoUrls: ['https://example.com/v.mp4'],
      audioUrls: ['https://example.com/a.wav']
    });

    expect(gatewayRun).toHaveBeenCalledWith(
      { path: 'bytedance/seedance-2.5/reference-to-video' },
      { prompt: 'a picture', video_urls: ['https://example.com/v.mp4'], audio_urls: ['https://example.com/a.wav'] },
      undefined
    );
  });

  it('refuses a video reference to an uncensored model that takes videos', async () => {
    const takesVideo = { ...uncensoredModel, spec: { ...uncensoredModel.spec, fields: { prompt: 'prompt', images: [], video: 'video_url' } } };
    const { deps, gatewayRun } = depsFor(takesVideo);

    const out = await startTaskRun(deps, { ...baseRequest, scope: SCOPE, modelId: takesVideo.id, videoUrls: ['https://example.com/v.mp4'] });

    expect(out).toEqual({ kind: 'refused', error: TASK_REFUSALS.noInputsAllowed, stage: RefusalStage.Policy });
    expect(gatewayRun).not.toHaveBeenCalled();
  });

  it('ignores a connected video an uncensored image model never receives', async () => {
    const { deps, gatewayRun } = depsFor(uncensoredModel);

    await startTaskRun(deps, { ...baseRequest, scope: SCOPE, modelId: uncensoredModel.id, videoUrls: ['https://example.com/v.mp4'] });

    expect(gatewayRun).toHaveBeenCalled();
  });
});

describe('startTaskRun — a provider with a concurrency cap', () => {
  const busyDeps = (load: { inFlight: number; waiting: number; cap: number }) => {
    const made = depsFor(referenceVideo);
    made.deps.providers = { higgsfield: made.deps.providers.wiro };
    made.deps.load = async () => load;
    return made;
  };
  const request = (place?: QueuePlace) => ({ ...baseRequest, mode: ProjectMode.Standard, scope: SCOPE, modelId: referenceVideo.id, place });

  it('waits instead of submitting when every slot is taken', async () => {
    const { deps, gatewayRun } = busyDeps({ inFlight: 4, waiting: 0, cap: 4 });

    expect(await startTaskRun(deps, request())).toEqual({ kind: 'waiting' });
    expect(gatewayRun).not.toHaveBeenCalled();
  });

  it('queues a new run behind runs already waiting, even with a free slot', async () => {
    const { deps, gatewayRun } = busyDeps({ inFlight: 3, waiting: 1, cap: 4 });

    expect(await startTaskRun(deps, request(QueuePlace.New))).toEqual({ kind: 'waiting' });
    expect(gatewayRun).not.toHaveBeenCalled();
  });

  it('submits a waiting run as soon as a slot frees', async () => {
    const { deps, gatewayRun } = busyDeps({ inFlight: 3, waiting: 1, cap: 4 });

    expect(await startTaskRun(deps, request(QueuePlace.Waiting))).toEqual({ kind: 'job', jobId: 'higgsfield:job-1' });
    expect(gatewayRun).toHaveBeenCalled();
  });

  it('waits, unbilled, when the provider itself answers that it is busy', async () => {
    const { deps } = busyDeps({ inFlight: 0, waiting: 0, cap: 4 });
    (deps.providers.higgsfield!.run as ReturnType<typeof vi.fn>).mockRejectedValue(new ProviderBusyError('higgsfield_busy'));

    expect(await startTaskRun(deps, request())).toEqual({ kind: 'waiting' });
    expect(deps.bill).not.toHaveBeenCalled();
  });
});

describe('startTaskRun — a model that edits a video', () => {
  it('refuses before any call when no source video is wired', async () => {
    const editor: TaskModel = { ...referenceVideo, spec: { ...referenceVideo.spec, fields: { prompt: 'prompt', images: [], video: 'video_url' }, requiresVideo: true } };
    const { deps, gatewayRun } = depsFor(editor);
    deps.providers = { higgsfield: deps.providers.wiro };

    const out = await startTaskRun(deps, { ...baseRequest, mode: ProjectMode.Standard, scope: SCOPE, modelId: editor.id });

    expect(out).toEqual({ kind: 'refused', error: TASK_REFUSALS.needsVideo, stage: RefusalStage.Policy });
    expect(gatewayRun).not.toHaveBeenCalled();
  });
});

describe('a model billed per source second, quoted on the real request', () => {
  const restyle: TaskModel = {
    id: 'higgsfield/higgsfield/genjutsu/restyle/v1.0',
    catalogue: 'video',
    spec: { path: 'higgsfield/genjutsu/restyle/v1.0', fields: { prompt: 'prompt', images: [], video: 'video_url' }, quotedAtSubmit: true },
    uncensored: false,
    paramSchema: {}
  };
  const quoting = (usd: number | null) => {
    const made = depsFor(restyle);
    const quote = vi.fn().mockResolvedValue(usd);
    made.deps.providers = { higgsfield: { ...made.deps.providers.wiro!, quote } };
    return { ...made, quote };
  };
  const request = { ...baseRequest, mode: ProjectMode.Standard, scope: SCOPE, modelId: restyle.id, videoUrls: ['https://cdn.test/source.mp4'] };

  it('asks the provider the price of these exact inputs and carries it with the job', async () => {
    const { deps, quote } = quoting(13.6);

    const out = await startTaskRun(deps, request);

    expect(quote).toHaveBeenCalledWith({ path: 'higgsfield/genjutsu/restyle/v1.0' }, { prompt: 'a picture', video_url: 'https://cdn.test/source.mp4' });
    expect(out).toEqual({ kind: 'job', jobId: 'higgsfield:job-1', quotedUsd: 13.6 });
  });

  it('never runs what it cannot price', async () => {
    const { deps, gatewayRun } = quoting(null);

    expect(await startTaskRun(deps, request)).toEqual({ kind: 'refused', error: TASK_REFUSALS.unpriced, stage: RefusalStage.Provider });
    expect(gatewayRun).not.toHaveBeenCalled();
  });

  it('bills the finished task at the price quoted on submit', async () => {
    const bill = vi.fn();
    const providers = { higgsfield: { run: vi.fn(), task: vi.fn().mockResolvedValue({ state: 'failed', error: 'higgsfield_failed: x' }) } };

    await finishTaskJob({} as never, { providers, model: async () => restyle, bill }, { externalJobId: 'higgsfield:r1', modelId: restyle.id, scope: SCOPE, mode: ProjectMode.Standard, params: { quotedUsd: 13.6 } as never });

    expect(bill).toHaveBeenCalledWith(expect.objectContaining({ quotedUsd: 13.6 }));
  });
});

describe('a model that needs a param the person must choose', () => {
  it('refuses before any call when the style is not chosen', async () => {
    const restyle: TaskModel = { ...referenceVideo, spec: { ...referenceVideo.spec, requiredParams: ['preset_id'] }, paramSchema: { preset_id: { type: 'enum', values: ['u1'] } } };
    const { deps, gatewayRun } = depsFor(restyle);
    deps.providers = { higgsfield: deps.providers.wiro };

    const out = await startTaskRun(deps, { ...baseRequest, mode: ProjectMode.Standard, scope: SCOPE, modelId: restyle.id });

    expect(out).toEqual({ kind: 'refused', error: 'missing_input: choose a style', stage: RefusalStage.Policy });
    expect(gatewayRun).not.toHaveBeenCalled();
  });
});

