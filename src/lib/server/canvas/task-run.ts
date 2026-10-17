import type { Db } from '$lib/server/db/client';
import { markGenerated } from '$lib/server/content-credentials';
import type { Actor } from '$lib/server/repos/actor';
import { insertAsset, type Asset, type AssetType } from '$lib/server/repos/assets';
import type { GenParams } from '$lib/canvas/gen-node';
import { jobPrefixOf, taskJobOf, taskProviderOf, TASK_PROVIDERS, TaskProviderName } from '$lib/server/generation/task-providers';
import { taskUsdFor } from '$lib/server/generation/task-pricing';
import { uncensoredRefusal, UNCENSORED_REFUSALS } from '$lib/server/generation/uncensored-guard';
import { screenGeneration, type ScreenPorts } from '$lib/server/moderation/screen';
import { ProviderBusyError, type TaskProvider, type TaskOutput, type TaskWireRef, type WireFields } from './task-provider';
import { wireInputs, type ListCaps } from '$lib/server/generation/wire-inputs';
import type { Purgers } from './provider-purge';
import { ProjectMode, STORAGE_FOLDER } from '$lib/project-mode';
import { ModerationProfile, profileOf } from '$lib/server/moderation/profiles';
import { likenessRefusal, type ProvenanceEntry } from './likeness-guard';
import { MODEL3D_MIME } from '$lib/model3d-models';
import { labelOf } from '$lib/canvas/model-params';

const GENERATED_MEDIA_BUCKET = 'brand-knowledge';
export const taskLabelOf = (provider: TaskProviderName): string => `canvas.${provider}`;

const EXTENSION_OF_MIME: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  [MODEL3D_MIME]: 'glb'
};

const MIME_OF_EXTENSION: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(EXTENSION_OF_MIME).map(([mime, extension]) => [extension, mime])
);

const ASSET_TYPE_OF_MIME_FAMILY: Readonly<Record<string, AssetType>> = { image: 'image', video: 'video', model: 'model3d' };

const isGlbOutput = (output: TaskOutput): boolean => output.contentType === MODEL3D_MIME || extensionOf(output.url) === 'glb';
const isImageOutput = (output: TaskOutput): boolean => output.contentType.startsWith('image/') || mimeOfUrl(output.url)?.startsWith('image/') === true;

const PRIMARY_OUTPUT: Readonly<Record<TaskCatalogue, (outputs: TaskOutput[]) => TaskOutput | undefined>> = {
  image: (outputs) => outputs[0],
  video: (outputs) => outputs[0],
  model3d: (outputs) => outputs.find(isGlbOutput)
};

const POSTER_OUTPUT: Readonly<Partial<Record<TaskCatalogue, (outputs: TaskOutput[]) => TaskOutput | undefined>>> = {
  model3d: (outputs) => outputs.find(isImageOutput)
};

function extensionOf(url: string): string {
  return new URL(url).pathname.split('.').pop()?.toLowerCase() ?? '';
}

function mimeOfUrl(url: string): string | undefined {
  return MIME_OF_EXTENSION[extensionOf(url)];
}

export const TASK_REFUSALS = {
  notConfigured: 'provider_not_configured',
  unknownModel: 'model_not_synced',
  notEnabled: UNCENSORED_REFUSALS.disabled,
  noInputsAllowed: UNCENSORED_REFUSALS.inputs,
  noOutput: 'task_failed: no output',
  needsImage: 'missing_input: this model needs an input image',
  needsVideo: 'missing_input: this model needs a source video',
  unpriced: 'price_unavailable: the provider did not quote this request'
} as const;

export type TaskScope = { orgId: string; projectId: string; nodeId: string; userId: string; actor?: Actor };

export type TaskCatalogue = 'image' | 'video' | 'model3d';

export type TaskWireSpec = {
  fields: WireFields;
  fixed?: Readonly<Record<string, string>>;
  requiresImage?: boolean;
  requiresVideo?: boolean;
  quotedAtSubmit?: boolean;
  requiredParams?: readonly string[];
  menuGroup?: string;
  unrunnable?: string;
  caps?: ListCaps;
} & Readonly<Record<string, unknown>>;

export type TaskModel = {
  id: string;
  catalogue: TaskCatalogue;
  spec: TaskWireSpec;
  uncensored: boolean;
  paramSchema: Record<string, unknown>;
  pricing?: unknown;
};

export type TaskBill = {
  provider: TaskProviderName;
  model: string;
  quotedUsd: number | null;
  ms: number;
  costUsd: number | null;
  error?: string;
  uncensored: boolean;
  scope: TaskScope;
};

export type ProviderLoad = { inFlight: number; waiting: number; cap: number | null };

export enum QueuePlace {
  New = 'new',
  Waiting = 'waiting'
}

export type TaskRunDeps = {
  providers: Readonly<Partial<Record<TaskProviderName, TaskProvider>>>;
  load?(provider: TaskProviderName): Promise<ProviderLoad>;
  model(id: string): Promise<TaskModel | null>;
  access(orgId: string): Promise<{ allowed: boolean }>;
  screen(scope: TaskScope, model: TaskModel): ScreenPorts;
  refuseLikeness(scope: TaskScope, model: TaskModel, reason: string): void;
  bill(entry: TaskBill): void;
};

export type TaskRequest = {
  scope: TaskScope;
  mode: ProjectMode;
  modelId: string;
  prompt: string;
  params: GenParams;
  imageUrls: string[];
  lastFrameUrl: string | null;
  videoUrls?: string[];
  audioUrls?: string[];
  provenance: ProvenanceEntry[];
  idempotencyKey?: string;
  place?: QueuePlace;
};

export enum RefusalStage {
  Policy = 'policy',
  Provider = 'provider'
}

export const QUOTED_USD_PARAM = 'quotedUsd';

export type TaskStart = { kind: 'job'; jobId: string; quotedUsd?: number } | { kind: 'waiting' } | { kind: 'refused'; error: string; stage: RefusalStage };

const WAITING: TaskStart = { kind: 'waiting' };

const AHEAD_OF: Readonly<Record<QueuePlace, (load: ProviderLoad) => number>> = {
  [QueuePlace.New]: (load) => load.inFlight + load.waiting,
  [QueuePlace.Waiting]: (load) => load.inFlight
};

async function slotFree(deps: TaskRunDeps, provider: TaskProviderName, place: QueuePlace): Promise<boolean> {
  const load = await deps.load?.(provider);
  return !load || load.cap === null || AHEAD_OF[place](load) < load.cap;
}

function carriesInputs(req: Pick<TaskRequest, 'imageUrls' | 'lastFrameUrl' | 'videoUrls' | 'audioUrls' | 'provenance'>): boolean {
  const media = [req.imageUrls, req.videoUrls ?? [], req.audioUrls ?? [], req.provenance];
  return media.some((list) => list.length > 0) || req.lastFrameUrl !== null;
}

function consumedBy(fields: WireFields, req: TaskRequest): TaskRequest {
  const takesVideo = Boolean(fields.video || fields.videoList);
  return { ...req, videoUrls: takesVideo ? req.videoUrls : [], audioUrls: fields.audioList ? req.audioUrls : [] };
}

const LIKENESS_GUARDED_IN_UNCENSORED_PROJECTS: ReadonlySet<TaskCatalogue> = new Set(['model3d']);

function guardsLikeness(model: TaskModel, mode: ProjectMode): boolean {
  return model.uncensored || (mode === ProjectMode.Uncensored && LIKENESS_GUARDED_IN_UNCENSORED_PROJECTS.has(model.catalogue));
}

function quoteOf(model: TaskModel, inputs: Record<string, unknown>): number | null {
  return taskUsdFor(model.pricing, inputs);
}

function refused(error: string, stage = RefusalStage.Policy): TaskStart {
  return { kind: 'refused', error, stage };
}

async function submitQuote(gateway: TaskProvider, ref: TaskWireRef, inputs: Record<string, unknown>): Promise<{ quotedUsd: number } | null> {
  const usd = await gateway.quote?.(ref, inputs).catch(() => null);
  return usd ? { quotedUsd: usd } : null;
}

export async function startTaskRun(deps: TaskRunDeps, req: TaskRequest): Promise<TaskStart> {
  const model = await deps.model(req.modelId);
  const provider = taskProviderOf(req.modelId);
  if (!model || !provider) {
    return refused(TASK_REFUSALS.unknownModel);
  }
  if (model.spec.unrunnable) {
    return refused(TASK_REFUSALS.unknownModel);
  }
  if (model.spec.requiresImage && !req.imageUrls.length) {
    return refused(TASK_REFUSALS.needsImage);
  }
  if (model.spec.requiresVideo && !req.videoUrls?.length) {
    return refused(TASK_REFUSALS.needsVideo);
  }
  const unchosen = model.spec.requiredParams?.find((name) => !(req.params as Record<string, unknown>)[name]);
  if (unchosen) {
    return refused(`missing_input: choose a ${labelOf(unchosen).toLowerCase()}`);
  }

  const uncensored = uncensoredRefusal({
    uncensored: model.uncensored,
    mode: req.mode,
    carriesInputs: carriesInputs(consumedBy(model.spec.fields, req)),
    accessAllowed: model.uncensored ? (await deps.access(req.scope.orgId)).allowed : true
  });
  if (uncensored) {
    return refused(uncensored);
  }

  const gateway = deps.providers[provider];
  if (!gateway) {
    return refused(TASK_REFUSALS.notConfigured, RefusalStage.Provider);
  }

  const likeness = guardsLikeness(model, req.mode) ? likenessRefusal(req.provenance) : null;
  if (likeness) {
    deps.refuseLikeness(req.scope, model, likeness);
    return refused(likeness);
  }

  const screened = await screenGeneration(deps.screen(req.scope, model), {
    text: req.prompt,
    references: req.provenance.map((p) => p.label),
    uncensored: profileOf({ uncensored: model.uncensored, mode: req.mode }) === ModerationProfile.Uncensored,
    operation: model.catalogue
  });
  if (!screened.ok) {
    return refused(screened.error);
  }

  const inputs = wireInputs(model.spec, req, model.paramSchema);
  const { fields: _fields, fixed: _fixed, requiresImage: _requiresImage, requiresVideo: _requiresVideo, quotedAtSubmit: _quotedAtSubmit, requiredParams: _requiredParams, menuGroup: _menuGroup, unrunnable: _unrunnable, caps: _caps, ...ref } = model.spec;
  if (!(await slotFree(deps, provider, req.place ?? QueuePlace.New))) {
    return WAITING;
  }
  const quoted = model.spec.quotedAtSubmit ? await submitQuote(gateway, ref, inputs) : {};
  if (quoted === null) {
    return refused(TASK_REFUSALS.unpriced, RefusalStage.Provider);
  }
  const startedAt = Date.now();
  try {
    const { taskId } = await gateway.run(ref, inputs, req.idempotencyKey);
    return { kind: 'job', jobId: `${jobPrefixOf(provider)}${taskId}`, ...quoted };
  } catch (error) {
    if (error instanceof ProviderBusyError) {
      return WAITING;
    }
    const message = error instanceof Error ? error.message : `${provider}_failed`;
    deps.bill({ provider, model: model.id, quotedUsd: quoteOf(model, inputs), ms: Date.now() - startedAt, costUsd: null, error: message, uncensored: model.uncensored, scope: req.scope });
    return refused(message, RefusalStage.Provider);
  }
}

export type TaskProgress =
  | { state: 'pending' }
  | { state: 'failed'; error: string }
  | { state: 'landed'; asset: Asset; poster: Asset | null; costUsd: number | null; uncensored: boolean };

export const TASK_TIMED_OUT = 'task_timeout';

async function download(output: TaskOutput): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await fetch(output.url);
  if (!res.ok) {
    throw new Error(`download_failed: HTTP ${res.status}`);
  }
  const declared = res.headers.get('content-type') ?? output.contentType;
  return { bytes: new Uint8Array(await res.arrayBuffer()), mime: mimeOfUrl(output.url) ?? declared };
}

async function deposit(db: Db, job: { scope: TaskScope; mode: ProjectMode }, provider: TaskProviderName, model: TaskModel, file: { bytes: Uint8Array; mime: string }): Promise<Asset> {
  const { scope } = job;
  const path = `${scope.userId}/${STORAGE_FOLDER[job.mode]}/${TASK_PROVIDERS[provider].storageFolder}/${crypto.randomUUID()}.${EXTENSION_OF_MIME[file.mime] ?? 'bin'}`;
  const marked = await markGenerated(Buffer.from(file.bytes), file.mime, { model: model.id, provider });
  const { error } = await db.storage
    .from(GENERATED_MEDIA_BUCKET)
    .upload(path, new Blob([marked.bytes as BlobPart], { type: file.mime }), { contentType: file.mime, upsert: false });
  if (error) {
    throw new Error(`store_failed: ${error.message}`);
  }

  return insertAsset(db, {
    orgId: scope.orgId,
    projectId: scope.projectId,
    type: ASSET_TYPE_OF_MIME_FAMILY[file.mime.split('/')[0]] ?? 'image',
    source: 'generated',
    url: path,
    mimeType: file.mime,
    bytes: marked.bytes.byteLength,
    sourceNodeId: scope.nodeId,
    uncensored: model.uncensored,
    aiMarked: marked.marked
  });
}

type TaskJob = {
  externalJobId: string;
  modelId: string;
  scope: TaskScope;
  mode: ProjectMode;
  params?: GenParams;
  startedAt?: string;
  now?: number;
};

function outlivedFallback(provider: TaskProviderName, model: TaskModel, job: TaskJob): boolean {
  const limit = TASK_PROVIDERS[provider].fallbackAfterMs?.[model.catalogue];
  if (!limit || !job.startedAt) {
    return false;
  }
  return (job.now ?? Date.now()) - new Date(job.startedAt).getTime() > limit;
}

function jobQuote(model: TaskModel, job: TaskJob): number | null {
  const quoted = Number((job.params as Record<string, unknown> | undefined)?.[QUOTED_USD_PARAM]);
  if (Number.isFinite(quoted) && quoted > 0) {
    return quoted;
  }
  const inputs = wireInputs(model.spec, { prompt: '', params: job.params ?? {}, imageUrls: [], lastFrameUrl: null }, model.paramSchema);
  return quoteOf(model, inputs);
}

export async function finishTaskJob(db: Db, deps: Pick<TaskRunDeps, 'providers' | 'model' | 'bill'>, job: TaskJob): Promise<TaskProgress> {
  const parsed = taskJobOf(job.externalJobId);
  const model = await deps.model(job.modelId);
  const gateway = parsed ? deps.providers[parsed.provider] : undefined;
  if (!parsed || !gateway || !model) {
    return { state: 'failed', error: gateway ? TASK_REFUSALS.unknownModel : TASK_REFUSALS.notConfigured };
  }

  const { provider, taskId } = parsed;
  const bill = (costUsd: number | null, error?: string) =>
    deps.bill({ provider, model: model.id, quotedUsd: jobQuote(model, job), ms: elapsedMs(job), costUsd, error, uncensored: model.uncensored, scope: job.scope });

  const task = await gateway.task(taskId);
  if (task.state === 'pending' && outlivedFallback(provider, model, job)) {
    await gateway.cancel?.(taskId).catch(() => false);
    bill(null, TASK_TIMED_OUT);
    return { state: 'failed', error: TASK_TIMED_OUT };
  }
  if (task.state === 'pending') {
    return task;
  }
  if (task.state === 'failed') {
    bill(null, task.error);
    return task;
  }

  const output = PRIMARY_OUTPUT[model.catalogue](task.outputs);
  if (!output) {
    bill(null, TASK_REFUSALS.noOutput);
    return { state: 'failed', error: TASK_REFUSALS.noOutput };
  }
  const costUsd = task.costUsd ?? jobQuote(model, job);
  bill(costUsd);

  const posterOutput = POSTER_OUTPUT[model.catalogue]?.(task.outputs);
  const [asset, poster] = await Promise.all([
    deposit(db, job, provider, model, await download(output)),
    posterOutput ? download(posterOutput).then((file) => deposit(db, job, provider, model, file)) : null
  ]);
  return { state: 'landed', asset, poster, costUsd, uncensored: model.uncensored };
}

function elapsedMs(job: TaskJob): number {
  return job.startedAt ? Math.max(0, (job.now ?? Date.now()) - new Date(job.startedAt).getTime()) : 0;
}

export function taskPurgers(providers: Readonly<Partial<Record<TaskProviderName, TaskProvider>>>): Purgers {
  return Object.fromEntries(
    (Object.entries(providers) as Array<[TaskProviderName, TaskProvider | undefined]>)
      .filter(([, gateway]) => gateway?.purge)
      .map(([provider, gateway]) => [jobPrefixOf(provider), (externalJobId: string) => gateway!.purge!(externalJobId.slice(jobPrefixOf(provider).length))])
  );
}
