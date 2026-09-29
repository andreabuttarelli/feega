import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { insertAsset, type Asset, type AssetType } from '$lib/server/repos/assets';
import { WIRO_JOB_PREFIX } from '$lib/server/repos/node-runs';
import type { GenParams } from '$lib/canvas/gen-node';
import type { WiroFields, WiroWireSpec } from '$lib/server/wiro-catalogue';
import { screenGeneration, type ScreenPorts } from '$lib/server/moderation/screen';
import type { WiroGateway, WiroOutput } from './wiro-gateway';
import { moderationProfileOf, ModerationProfile, STORAGE_FOLDER, type ProjectMode } from '$lib/project-mode';
import { likenessRefusal, type ProvenanceEntry } from './likeness-guard';

const GENERATED_MEDIA_BUCKET = 'brand-knowledge';
export const WIRO_LABEL = 'canvas.wiro';
const CONTROLLED_SCHEMA_KEYS = new Set(['aspect_ratio', 'resolution', 'duration']);

const EXTENSION_OF_MIME: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm'
};

const ASSET_TYPE_OF_MEDIUM: Readonly<Record<string, AssetType>> = { image: 'image', video: 'video' };

export const WIRO_REFUSALS = {
  notConfigured: 'wiro_not_configured',
  unknownModel: 'wiro_model_not_synced',
  notEnabled: 'Uncensored models are off for this workspace. The owner can turn them on in Settings.',
  noInputsAllowed: "Uncensored models don't accept references: remove every incoming connection and reference first.",
  noOutput: 'wiro_task_failed: no output'
} as const;

export type WiroScope = { orgId: string; projectId: string; nodeId: string; userId: string; actor?: Actor };

export type WiroModel = { id: string; catalogue: 'image' | 'video'; spec: WiroWireSpec; uncensored: boolean; paramSchema: Record<string, unknown> };

export type WiroBill = {
  model: string;
  ms: number;
  costUsd: number | null;
  error?: string;
  uncensored: boolean;
  scope: WiroScope;
};

export type WiroRunDeps = {
  gateway: WiroGateway | null;
  model(id: string): Promise<WiroModel | null>;
  access(orgId: string): Promise<{ allowed: boolean }>;
  screen(scope: WiroScope, model: WiroModel): ScreenPorts;
  refuseLikeness(scope: WiroScope, model: WiroModel, reason: string): void;
  bill(entry: WiroBill): void;
};

export type WiroRequest = {
  scope: WiroScope;
  mode: ProjectMode;
  modelId: string;
  prompt: string;
  params: GenParams;
  imageUrls: string[];
  lastFrameUrl: string | null;
  provenance: ProvenanceEntry[];
};

export type WiroStart = { kind: 'job'; jobId: string } | { kind: 'refused'; error: string };

function carriesInputs(req: Pick<WiroRequest, 'imageUrls' | 'lastFrameUrl' | 'provenance'>): boolean {
  return req.imageUrls.length > 0 || req.lastFrameUrl !== null || req.provenance.length > 0;
}

function extraInputs(params: GenParams, schema: Record<string, unknown>): Record<string, unknown> {
  const raw = params as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(schema)
      .filter((key) => !CONTROLLED_SCHEMA_KEYS.has(key) && raw[key] !== undefined)
      .map((key) => [key, String(raw[key])])
  );
}

export function wiroInputs(fields: WiroFields, input: Omit<WiroRequest, 'scope' | 'mode' | 'modelId' | 'provenance'>, schema: Record<string, unknown>): Record<string, unknown> {
  const inputs: Record<string, unknown> = { ...extraInputs(input.params, schema), [fields.prompt]: input.prompt };
  const controls: Array<[string | undefined, unknown]> = [
    [fields.aspectRatio, input.params.aspectRatio],
    [fields.resolution, input.params.resolution],
    [fields.duration, input.params.duration]
  ];
  for (const [wireId, value] of controls) {
    if (wireId && value !== undefined && value !== null && value !== '') {
      inputs[wireId] = String(value);
    }
  }
  fields.images.forEach((wireId, index) => {
    if (input.imageUrls[index]) {
      inputs[wireId] = input.imageUrls[index];
    }
  });
  if (fields.lastFrame && input.lastFrameUrl) {
    inputs[fields.lastFrame] = input.lastFrameUrl;
  }
  return inputs;
}

export async function startWiroRun(deps: WiroRunDeps, req: WiroRequest): Promise<WiroStart> {
  const model = await deps.model(req.modelId);
  if (!model) {
    return { kind: 'refused', error: WIRO_REFUSALS.unknownModel };
  }
  if (model.uncensored && !(await deps.access(req.scope.orgId)).allowed) {
    return { kind: 'refused', error: WIRO_REFUSALS.notEnabled };
  }
  if (model.uncensored && carriesInputs(req)) {
    return { kind: 'refused', error: WIRO_REFUSALS.noInputsAllowed };
  }
  if (!deps.gateway) {
    return { kind: 'refused', error: WIRO_REFUSALS.notConfigured };
  }

  const likeness = model.uncensored ? likenessRefusal(req.provenance) : null;
  if (likeness) {
    deps.refuseLikeness(req.scope, model, likeness);
    return { kind: 'refused', error: likeness };
  }

  const screened = await screenGeneration(deps.screen(req.scope, model), {
    text: req.prompt,
    references: req.provenance.map((p) => p.label),
    uncensored: moderationProfileOf(req.mode, model.uncensored) === ModerationProfile.Adult
  });
  if (!screened.ok) {
    return { kind: 'refused', error: screened.error };
  }

  const startedAt = Date.now();
  try {
    const { taskId } = await deps.gateway.run(
      { owner: model.spec.owner, project: model.spec.project },
      wiroInputs(model.spec.fields, req, model.paramSchema)
    );
    return { kind: 'job', jobId: `${WIRO_JOB_PREFIX}${taskId}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'wiro_failed';
    deps.bill({ model: model.id, ms: Date.now() - startedAt, costUsd: null, error: message, uncensored: model.uncensored, scope: req.scope });
    return { kind: 'refused', error: message };
  }
}

export type WiroProgress =
  | { state: 'pending' }
  | { state: 'failed'; error: string }
  | { state: 'landed'; asset: Asset; costUsd: number; uncensored: boolean };

async function download(output: WiroOutput): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await fetch(output.url);
  if (!res.ok) {
    throw new Error(`wiro_download_failed: HTTP ${res.status}`);
  }
  return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get('content-type') ?? output.contentType };
}

async function deposit(db: Db, job: { scope: WiroScope; mode: ProjectMode }, model: WiroModel, file: { bytes: Uint8Array; mime: string }): Promise<Asset> {
  const { scope } = job;
  const path = `${scope.userId}/${STORAGE_FOLDER[job.mode]}/wiro/${crypto.randomUUID()}.${EXTENSION_OF_MIME[file.mime] ?? 'bin'}`;
  const { error } = await db.storage
    .from(GENERATED_MEDIA_BUCKET)
    .upload(path, new Blob([file.bytes as BlobPart], { type: file.mime }), { contentType: file.mime, upsert: false });
  if (error) {
    throw new Error(`store_failed: ${error.message}`);
  }

  return insertAsset(db, {
    orgId: scope.orgId,
    projectId: scope.projectId,
    type: ASSET_TYPE_OF_MEDIUM[model.catalogue],
    source: 'generated',
    url: path,
    mimeType: file.mime,
    bytes: file.bytes.byteLength,
    sourceNodeId: scope.nodeId,
    uncensored: model.uncensored
  });
}

export async function finishWiroJob(
  db: Db,
  deps: Pick<WiroRunDeps, 'gateway' | 'model' | 'bill'>,
  job: { externalJobId: string; modelId: string; scope: WiroScope; mode: ProjectMode }
): Promise<WiroProgress> {
  const model = await deps.model(job.modelId);
  if (!deps.gateway || !model) {
    return { state: 'failed', error: deps.gateway ? WIRO_REFUSALS.unknownModel : WIRO_REFUSALS.notConfigured };
  }

  const startedAt = Date.now();
  const task = await deps.gateway.task(job.externalJobId.slice(WIRO_JOB_PREFIX.length));
  if (task.state === 'pending') {
    return task;
  }
  if (task.state === 'failed') {
    deps.bill({ model: model.id, ms: Date.now() - startedAt, costUsd: null, error: task.error, uncensored: model.uncensored, scope: job.scope });
    return task;
  }

  const output = task.outputs[0];
  if (!output) {
    return { state: 'failed', error: WIRO_REFUSALS.noOutput };
  }
  deps.bill({ model: model.id, ms: Date.now() - startedAt, costUsd: task.costUsd, uncensored: model.uncensored, scope: job.scope });

  const asset = await deposit(db, job, model, await download(output));
  return { state: 'landed', asset, costUsd: task.costUsd, uncensored: model.uncensored };
}

