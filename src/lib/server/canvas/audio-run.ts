import type { Db } from '$lib/server/db/client';
import { insertAsset, type Asset, type AssetType } from '$lib/server/repos/assets';
import { AUDIO_JOB_PREFIX } from '$lib/server/repos/node-runs';
import type { Actor } from '$lib/server/repos/actor';
import { logAiCall } from '$lib/server/ai-log';
import {
  AUDIO_PROBLEM_MESSAGE,
  audioDurationOf,
  audioInputProblem,
  audioUsdFor,
  operationSpec,
  type AudioMeasure,
  type AudioOperationId,
  type AudioParams
} from '$lib/canvas/audio-operations';
import type { AudioFile, AudioProvider, VoiceSettings } from './audio-provider';

const GENERATED_MEDIA_BUCKET = 'brand-knowledge';
const MP3_BYTES_PER_SECOND = 16_000;
const AUDIO_LABEL = 'canvas.audio';
const PROVIDER = 'elevenlabs';
const DUBBING_JOB = 'dubbing';
const VIDEO_MIME_PREFIX = 'video/';

const EXTENSION_OF_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov'
};

export type AudioScope = { orgId: string; projectId: string; nodeId: string; userId: string; actor?: Actor };

export type AudioRequest = {
  scope: AudioScope;
  operation: AudioOperationId;
  model: string;
  params: AudioParams;
  text: string;
  audioUrls: string[];
  videoUrls: string[];
};

export type AudioResult =
  | { kind: 'landed'; asset: Asset; costUsd: number | null }
  | { kind: 'job'; jobId: string }
  | { kind: 'refused'; error: string };

type Produced = { file: AudioFile } | { jobId: string };

type Perform = (provider: AudioProvider, req: AudioRequest, media: () => Promise<AudioFile>) => Promise<Produced>;

function settingsOf(params: AudioParams): VoiceSettings {
  const settings: VoiceSettings = {};
  if (typeof params.stability === 'number') {
    settings.stability = params.stability;
  }
  if (typeof params.similarity === 'number') {
    settings.similarity_boost = params.similarity;
  }
  if (typeof params.style === 'number') {
    settings.style = params.style;
  }
  return settings;
}

function secondsOf(req: AudioRequest): number {
  return audioDurationOf(req.operation, req.params) ?? 0;
}

const PERFORM: Record<AudioOperationId, Perform> = {
  text_to_speech: async (provider, req) => ({
    file: await provider.speak({ text: req.text, voiceId: req.params.voiceId ?? '', model: req.model, settings: settingsOf(req.params) })
  }),
  voice_changer: async (provider, req, media) => ({
    file: await provider.changeVoice({ media: await media(), voiceId: req.params.voiceId ?? '', model: req.model, settings: settingsOf(req.params) })
  }),
  voice_isolation: async (provider, _req, media) => ({ file: await provider.isolate({ media: await media() }) }),
  music: async (provider, req) => ({ file: await provider.compose({ prompt: req.text, seconds: secondsOf(req), model: req.model }) }),
  sound_effects: async (provider, req) => ({
    file: await provider.soundEffect({ prompt: req.text, seconds: secondsOf(req), model: req.model })
  }),
  dubbing: async (provider, req, media) => {
    const job = await provider.startDubbing({ media: await media(), targetLanguage: req.params.targetLanguage ?? '' });
    return { jobId: dubbingJobId(job.jobId, req.params.targetLanguage ?? '') };
  }
};

export function dubbingJobId(providerId: string, language: string): string {
  return `${AUDIO_JOB_PREFIX}${DUBBING_JOB}:${providerId}:${language}`;
}

export function parseDubbingJob(externalJobId: string): { providerId: string; language: string } | null {
  const [prefix, kind, providerId, language] = externalJobId.split(':');
  if (`${prefix}:` !== AUDIO_JOB_PREFIX || kind !== DUBBING_JOB || !providerId || !language) {
    return null;
  }
  return { providerId, language };
}

async function download(url: string): Promise<AudioFile> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`media_download_failed: HTTP ${res.status}`);
  }
  return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get('content-type') ?? 'application/octet-stream' };
}

function assetTypeOf(mime: string): AssetType {
  return mime.startsWith(VIDEO_MIME_PREFIX) ? 'video' : 'audio';
}

export function mp3Seconds(file: AudioFile): number {
  return Math.round((file.bytes.byteLength / MP3_BYTES_PER_SECOND) * 100) / 100;
}

function measureOf(req: AudioRequest, seconds: number): AudioMeasure {
  return operationSpec(req.operation).billedPer === 'character' ? { characters: req.text.length } : { seconds };
}

function bill(scope: AudioScope, entry: { operation: AudioOperationId; model: string; ms: number; costUsd: number | null; error?: string }) {
  logAiCall({
    label: AUDIO_LABEL,
    context: entry.operation,
    provider: PROVIDER,
    model: entry.model,
    ms: entry.ms,
    ok: !entry.error,
    error: entry.error,
    flatCostUsd: entry.costUsd ?? undefined,
    orgId: scope.orgId,
    projectId: scope.projectId,
    userId: scope.userId,
    actorKind: scope.actor?.kind ?? 'user',
    actorId: scope.actor?.id ?? scope.userId,
    agentKey: scope.actor?.agentKey ?? null
  });
}

export async function depositAudio(db: Db, scope: AudioScope, file: AudioFile, seconds: number): Promise<Asset> {
  const extension = EXTENSION_OF_MIME[file.mime] ?? 'bin';
  const path = `${scope.userId}/media/audio/${crypto.randomUUID()}.${extension}`;
  const { error } = await db.storage
    .from(GENERATED_MEDIA_BUCKET)
    .upload(path, new Blob([file.bytes as BlobPart], { type: file.mime }), { contentType: file.mime, upsert: false });
  if (error) {
    throw new Error(`store_failed: ${error.message}`);
  }

  return insertAsset(db, {
    orgId: scope.orgId,
    projectId: scope.projectId,
    type: assetTypeOf(file.mime),
    source: 'generated',
    url: path,
    mimeType: file.mime,
    bytes: file.bytes.byteLength,
    durationS: seconds,
    sourceNodeId: scope.nodeId
  });
}

export async function runAudio(db: Db, provider: AudioProvider, req: AudioRequest): Promise<AudioResult> {
  const problem = audioInputProblem(
    req.operation,
    { text: req.text, audio: req.audioUrls.length, video: req.videoUrls.length },
    req.params
  );
  if (problem) {
    return { kind: 'refused', error: AUDIO_PROBLEM_MESSAGE[problem] };
  }

  const firstMedia = req.audioUrls[0] ?? req.videoUrls[0];
  const startedAt = Date.now();
  let produced: Produced;
  try {
    produced = await PERFORM[req.operation](provider, req, () => download(firstMedia));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'audio_failed';
    bill(req.scope, { operation: req.operation, model: req.model, ms: Date.now() - startedAt, costUsd: null, error: message });
    return { kind: 'refused', error: message };
  }

  if ('jobId' in produced) {
    return { kind: 'job', jobId: produced.jobId };
  }

  const seconds = mp3Seconds(produced.file);
  const costUsd = audioUsdFor(req.operation, req.model, measureOf(req, seconds));
  bill(req.scope, { operation: req.operation, model: req.model, ms: Date.now() - startedAt, costUsd });

  const asset = await depositAudio(db, req.scope, produced.file, seconds);
  return { kind: 'landed', asset, costUsd };
}

export type JobProgress =
  | { state: 'pending' }
  | { state: 'failed'; error: string }
  | { state: 'landed'; asset: Asset; costUsd: number | null };

export async function finishAudioJob(
  db: Db,
  provider: AudioProvider,
  job: { externalJobId: string; model: string; scope: AudioScope }
): Promise<JobProgress> {
  const parsed = parseDubbingJob(job.externalJobId);
  if (!parsed) {
    return { state: 'failed', error: 'unknown_audio_job' };
  }

  const startedAt = Date.now();
  const status = await provider.dubbingStatus(parsed.providerId);
  if (status.state !== 'done') {
    return status;
  }

  const file = await provider.dubbedFile(parsed.providerId, parsed.language);
  const seconds = status.seconds ?? mp3Seconds(file);
  const costUsd = audioUsdFor('dubbing', job.model, { seconds });
  bill(job.scope, { operation: 'dubbing', model: job.model, ms: Date.now() - startedAt, costUsd });

  const asset = await depositAudio(db, job.scope, file, seconds);
  return { state: 'landed', asset, costUsd };
}
