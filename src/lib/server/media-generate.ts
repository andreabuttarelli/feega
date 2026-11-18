import type { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { signKnowledgePaths } from '$lib/server/media-archive';
import { IMAGE_PART_MAX_BYTES } from '$lib/raster-image';
import type { ImagePart, ImagePartRefusal } from '$lib/server/image-part';
import { safeProviderReason } from '$lib/server/provider-reason';
import { markGenerated } from '$lib/server/content-credentials';
import type { AspectRatio } from '$lib/server/media-generate.images';

const GENERATED_BUCKET = 'brand-knowledge';

export type GeneratedMedia = {
  id: null;
  kind: string;
  mime: string | null;
  width: number | null;
  height: number | null;
  url: string | null;
  storage_path?: string;
  ai_marked?: boolean;
};

export type GenerateMediaOpts = {
  orgId?: string;
  userId: string;
  prompt: string;
  kind?: 'image' | 'video';
  count?: number;
  aspectRatio?: AspectRatio;
  title?: string;
  model?: string;
  baseMediaId?: string;
  durationSeconds?: number;
  resolution?: string;
  lastFrameUrl?: string;
  referenceImageUrls?: string[];
  referenceAudioUrls?: string[];
  referenceVideoUrls?: string[];
  params?: Record<string, unknown>;
};

export type GenerateMediaResult =
  | {
      ok: true;
      status: 'ready';
      media: GeneratedMedia[];
      jobId: null;
      model: string | null;
      renders: number;
    }
  | {
      ok: true;
      status: 'rendering';
      media: [];
      jobId: string;
      model: string | null;
      renders: 0;
      durationSeconds: number | null;
    }
  | {
      ok: false;
      error:
        | 'render_failed'
        | 'store_failed'
        | 'video_budget_exhausted'
        | 'source_not_found'
        | 'source_not_an_image';
      reason?: string;
    }
  | { ok: false; error: 'duration_out_of_range'; reason: string }
  | { ok: false; error: 'model_not_for_slot'; allowed: string[] };

async function canvasModelAccepts(
  admin: SupabaseClient,
  medium: 'image' | 'video',
  model: string,
  orgId?: string
): Promise<boolean> {
  const { offerableModels } = await import('$lib/server/offerable-models');
  const { choices } = await offerableModels(admin, medium, undefined, orgId);
  return choices.some((c) => c.id === model);
}

const IMAGE_MIME = 'image/png';

export type SourceTooLarge = {
  ok: false;
  error: 'source_too_large';
  bytes: number | null;
  limit: number;
};

const SOURCE_REFUSAL: Record<ImagePartRefusal, 'source_too_large' | 'source_not_found'> = {
  too_large: 'source_too_large',
  not_an_image: 'source_not_found',
  fetch_failed: 'source_not_found'
};

function refusedSource(
  reason: ImagePartRefusal,
  bytes: number | null
): SourceTooLarge | { ok: false; error: 'source_not_found' } {
  const error = SOURCE_REFUSAL[reason];
  if (error === 'source_not_found') return { ok: false, error };

  return { ok: false, error, bytes, limit: IMAGE_PART_MAX_BYTES };
}

const PUBLIC_MEDIA = '/storage/v1/object/public/media/';

const CLIP_EXTENSION = /\.(mp4|mov|webm|m4v)$/i;

function ownStoragePath(userId: string, handle: string): string | null {
  const raw = handle.trim();
  const tail = raw.includes(PUBLIC_MEDIA) ? raw.split(PUBLIC_MEDIA)[1] : raw;
  const path = tail.split('?')[0].replace(/^\/+/, '');
  const segments = path.split('/');
  if (segments[0] !== userId) return null;
  if (segments.some((s) => s === '..' || s === '.' || !s)) return null;

  return path;
}

function storedKind(path: string): 'image' | 'video' {
  return CLIP_EXTENSION.test(path) ? 'video' : 'image';
}

async function signedPath(supabase: SupabaseClient, path: string): Promise<string | null> {
  return (await signKnowledgePaths(supabase, [path])).get(path) ?? null;
}

function dataUrlBytes(dataUrl: string): { bytes: Buffer; mime: string } | null {
  const [head, base64] = dataUrl.split(',');
  if (!base64) return null;

  return { bytes: Buffer.from(base64, 'base64'), mime: head?.match(/data:([^;]+)/)?.[1] ?? IMAGE_MIME };
}

type StoredDrawing = {
  storagePath: string;
  fileName: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  aiMarked: boolean;
};

export type DrawingStoreFailure = { reason: string };

async function probeImageDimensions(buf: Buffer): Promise<{ width: number | null; height: number | null }> {
  try {
    const meta = await sharp(buf).metadata();
    return { width: meta.width ?? null, height: meta.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

async function storeDrawing(
  supabase: SupabaseClient,
  folder: string,
  dataUrl: string,
  model: string | null
): Promise<StoredDrawing | DrawingStoreFailure> {
  const decoded = dataUrlBytes(dataUrl);
  if (!decoded) return { reason: 'the model returned no image data' };

  const { bytes, marked } = await markGenerated(decoded.bytes, decoded.mime, { model, provider: 'openrouter' });
  const ext = decoded.mime.includes('jpeg') ? 'jpg' : decoded.mime.includes('webp') ? 'webp' : 'png';
  const fileName = `generated-${crypto.randomUUID()}.${ext}`;
  const storagePath = `${folder}/${fileName}`;

  const { error } = await supabase.storage
    .from(GENERATED_BUCKET)
    .upload(storagePath, bytes, { contentType: decoded.mime, upsert: false });
  if (error) return { reason: error.message };

  const { width, height } = await probeImageDimensions(bytes);

  return { storagePath, fileName, mime: decoded.mime, bytes: bytes.length, width, height, aiMarked: marked };
}

function isStoredDrawing(result: StoredDrawing | DrawingStoreFailure): result is StoredDrawing {
  return 'storagePath' in result;
}

type DepositOutcome = { ok: true; media: GeneratedMedia } | { ok: false; reason: string };

async function handOverImage(
  supabase: SupabaseClient,
  opts: { userId: string },
  dataUrl: string,
  model: string | null
): Promise<DepositOutcome> {
  const drawn = await storeDrawing(supabase, `${opts.userId}/media`, dataUrl, model);
  if (!isStoredDrawing(drawn)) return { ok: false, reason: drawn.reason };

  const signed = await signKnowledgePaths(supabase, [drawn.storagePath]);
  const url = signed.get(drawn.storagePath);
  if (!url) return { ok: false, reason: 'the file was stored but could not be signed for reading' };

  return {
    ok: true,
    media: {
      id: null,
      kind: 'image',
      mime: drawn.mime,
      width: drawn.width,
      height: drawn.height,
      url,
      storage_path: drawn.storagePath,
      ai_marked: drawn.aiMarked
    }
  };
}

export type ImageJob = {
  orgId?: string;
  userId: string;
  prompt: string;
  count?: number;
  aspectRatio?: AspectRatio;
  resolution?: string;
  title?: string;
  model?: string;
  baseMediaId?: string;
  referenceImageUrls?: string[];
  params?: Record<string, unknown>;
};

export type ImageJobResult =
  | {
      ok: true;
      media: GeneratedMedia[];
      model: string | null;
      renders: number;
      costUsd: number | null;
    }
  | { ok: false; error: 'render_failed' | 'store_failed' | 'source_not_found'; reason?: string }
  | SourceTooLarge
  | { ok: false; error: 'model_not_for_slot'; allowed: string[] };

type SourceOutcome =
  | { ok: true; part: ImagePart }
  | { ok: false; reason: ImagePartRefusal; bytes: number | null };

const SOURCE_MISSING = { ok: false, reason: 'fetch_failed', bytes: null } as const;

async function storedImageSource(
  supabase: SupabaseClient,
  userId: string,
  handle: string
): Promise<SourceOutcome> {
  const path = ownStoragePath(userId, handle);
  if (!path) return SOURCE_MISSING;

  const url = await signedPath(supabase, path);
  if (!url) return SOURCE_MISSING;

  const { imagePartFor } = await import('$lib/server/image-part');
  const outcome = await imagePartFor(url);

  return outcome.ok ? outcome : { ...outcome, bytes: null };
}

async function referenceImageParts(urls: string[]): Promise<ImagePart[]> {
  const { imagePartFor } = await import('$lib/server/image-part');
  const outcomes = await Promise.all(urls.map((url) => imagePartFor(url)));
  return outcomes.flatMap((outcome) => (outcome.ok ? [outcome.part] : []));
}

async function runImageJob(
  supabase: SupabaseClient,
  job: ImageJob
): Promise<ImageJobResult> {
  const { renderPostImage, buildImageRequest } = await import('$lib/server/media-generate.images');

  if (job.model) {
    const { createAdminClient } = await import('$lib/server/supabase-admin');
    const accepted = await canvasModelAccepts(createAdminClient(), 'image', job.model, job.orgId);
    if (!accepted) {
      return { ok: false, error: 'model_not_for_slot', allowed: [] };
    }
  }

  const refining = !!job.baseMediaId;

  let baseImage: ImagePart | undefined;
  if (job.baseMediaId) {
    const found = await storedImageSource(supabase, job.userId, job.baseMediaId);
    if (!found.ok) return refusedSource(found.reason, found.bytes);
    baseImage = found.part;
  }

  const userRefImages = await referenceImageParts(job.referenceImageUrls ?? []);

  const opts = {
    model: refining ? undefined : job.model,
    refineModel: refining ? job.model : undefined,
    baseImage,
    userRefImages,
    aspectRatio: job.aspectRatio,
    resolution: job.resolution,
    params: job.params
  };

  const chosen = buildImageRequest(job.prompt, opts).model ?? null;

  const media: GeneratedMedia[] = [];
  let renders = 0;
  let renderError: string | undefined;
  for (let i = 0; i < (job.count ?? 1); i++) {
    renders += 1;
    const dataUrl = await renderPostImage(job.prompt, opts).catch((error: unknown) => {
      renderError = error instanceof Error ? error.message : undefined;
      return undefined;
    });
    if (!dataUrl) break;

    const filed = await handOverImage(supabase, job, dataUrl, chosen);
    if (!filed.ok) return { ok: false, error: 'store_failed', reason: filed.reason };

    media.push(filed.media);
  }

  if (!media.length) return { ok: false, error: 'render_failed', ...(renderError ? { reason: renderError } : {}) };

  const { billedUsdInScope } = await import('$lib/server/ai-log');

  return { ok: true, media, model: chosen, renders, costUsd: billedUsdInScope() ?? null };
}

export async function generateImages(
  supabase: SupabaseClient,
  job: ImageJob & { orgId: string }
): Promise<ImageJobResult> {
  const { withOrgContext } = await import('$lib/server/ai-log');

  return withOrgContext(job.orgId, () => runImageJob(supabase, job));
}

const VIDEO_ASPECTS = ['1:1', '9:16', '16:9'] as const;

function videoAspect(ratio?: AspectRatio) {
  return VIDEO_ASPECTS.find((a) => a === ratio);
}

type CoverLookup = { url: string } | { ok: false; error: 'source_not_found' | 'source_not_an_image' };

async function storedCoverUrl(
  admin: SupabaseClient,
  userId: string,
  handle: string
): Promise<CoverLookup> {
  const path = ownStoragePath(userId, handle);
  if (!path) return { ok: false, error: 'source_not_found' };
  if (storedKind(path) !== 'image') return { ok: false, error: 'source_not_an_image' };

  const url = await signedPath(admin, path);

  return url ? { url } : { ok: false, error: 'source_not_found' };
}

export type VideoJobResult =
  | {
      ok: true;
      status: 'rendering';
      media: [];
      jobId: string;
      model: string | null;
      renders: 0;
      durationSeconds: number | null;
    }
  | Extract<GenerateMediaResult, { ok: false }>;

async function startVideo(opts: GenerateMediaOpts): Promise<VideoJobResult> {
  const [{ createAdminClient }, { submitAndTrackVideoRender }] = await Promise.all([
    import('$lib/server/supabase-admin'),
    import('$lib/server/video-render-queue')
  ]);
  const admin = createAdminClient();

  if (opts.model) {
    const accepted = await canvasModelAccepts(admin, 'video', opts.model, opts.orgId);
    if (!accepted) {
      return { ok: false, error: 'model_not_for_slot', allowed: [] };
    }
  }

  let coverUrl: string | undefined;
  if (opts.baseMediaId) {
    const cover = await storedCoverUrl(admin, opts.userId, opts.baseMediaId);
    if ('error' in cover) return cover;
    coverUrl = cover.url;
  }

  const { resolveVideoModel, clampVideoDuration } = await import('$lib/server/video');
  const effectiveModel = resolveVideoModel({
    model: opts.model ?? null,
    hasCover: !!opts.baseMediaId
  });
  const wanted = opts.durationSeconds;
  if (wanted != null) {
    const achievable = clampVideoDuration(wanted, effectiveModel);
    if (achievable !== wanted) {
      return {
        ok: false,
        error: 'duration_out_of_range',
        reason: `${effectiveModel} cannot film ${wanted}s — the nearest it accepts is ${achievable}s. Ask for that instead; a clip is billed per second.`
      };
    }
  }

  let submitReason: string | undefined;
  const submitted = await submitAndTrackVideoRender({
    admin,
    onSubmitError: (why: string) => {
      submitReason = safeProviderReason(why);
    },
    orgId: opts.orgId,
    userId: opts.userId,
    postId: null,
    threadId: null,
    imagePrompt: opts.prompt,
    render: {
      aspectRatio: videoAspect(opts.aspectRatio),
      imageUrl: coverUrl,
      lastFrameUrl: coverUrl ? opts.lastFrameUrl : undefined,
      referenceImageUrls: opts.referenceImageUrls,
      referenceAudioUrls: opts.referenceAudioUrls,
      referenceVideoUrls: opts.referenceVideoUrls,
      duration: opts.durationSeconds,
      resolution: opts.resolution,
      model: opts.model,
      params: opts.params
    }
  });
  if (!submitted) return { ok: false, error: 'render_failed', ...(submitReason ? { reason: submitReason } : {}) };

  return {
    ok: true,
    status: 'rendering',
    media: [],
    jobId: submitted.jobId,
    model: submitted.model ?? null,
    renders: 0,
    durationSeconds: submitted.durationSeconds ?? wanted ?? null
  };
}

export async function generateVideo(
  opts: Omit<GenerateMediaOpts, 'kind' | 'title'> & { orgId: string }
): Promise<VideoJobResult> {
  const { withOrgContext } = await import('$lib/server/ai-log');

  return withOrgContext(opts.orgId, () => startVideo({ ...opts, kind: 'video' }));
}
