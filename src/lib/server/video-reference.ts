import type { Db } from '$lib/server/db/client';
import { ensureFfmpegPath } from '$lib/server/ffmpeg-bin';
import { ffmpegGrab, type GrabFrame } from '$lib/server/motion/reference-frames';
import type { ProjectMode } from '$lib/project-mode';
import { findAsset, type Asset } from '$lib/server/repos/assets';
import { BUCKET_BY_SOURCE, CANVAS_ASSET_BUCKET, SIGNED_URL_TTL_S, signStoredFile } from '$lib/server/repos/asset-storage';
import type { ScreenOutcome } from '$lib/server/moderation/screen';
import { BREAKDOWN_PROMPT, BREAKDOWN_VERSION, breakdownBrief, parseBreakdown, type VideoBreakdown } from '$lib/video-reference';

export enum BreakdownError {
  NotFound = 'video_not_found',
  NotVideo = 'not_a_video',
  Refused = 'video_refused',
  Unreadable = 'video_unreadable'
}

const MESSAGE_OF: Record<BreakdownError, string> = {
  [BreakdownError.NotFound]: 'No asset with that id in this workspace.',
  [BreakdownError.NotVideo]: 'That asset is not a video.',
  [BreakdownError.Refused]: 'The reference review refused this video.',
  [BreakdownError.Unreadable]: 'The video could not be read: try again, or describe it in words.'
};

export type BreakdownAnswer = { ok: true; assetId: string; breakdown: VideoBreakdown; brief: string } | { ok: false; error: BreakdownError; message: string };

export type BreakdownPorts = {
  watch: (url: string) => Promise<string>;
  screen: (url: string) => Promise<ScreenOutcome>;
};

const LIBRARY_FOLDER = 'library';
const JSON_MIME = 'application/json';
export const BREAKDOWN_LABEL = 'video.reference';

export function breakdownPath(ref: { orgId: string; projectId: string | null; assetId: string }): string {
  return `${ref.orgId}/${ref.projectId ?? LIBRARY_FOLDER}/analysis/${ref.assetId}.video.v${BREAKDOWN_VERSION}.json`;
}

const failed = (error: BreakdownError, message = MESSAGE_OF[error]): BreakdownAnswer => ({ ok: false, error, message });
const answered = (assetId: string, breakdown: VideoBreakdown): BreakdownAnswer => ({ ok: true, assetId, breakdown, brief: breakdownBrief(breakdown) });

async function stored(db: Db, path: string): Promise<VideoBreakdown | null> {
  const { data } = await db.storage.from(CANVAS_ASSET_BUCKET).download(path);
  if (!data) {
    return null;
  }
  return parseBreakdown(await data.text());
}

async function store(db: Db, path: string, breakdown: VideoBreakdown): Promise<void> {
  const body = new Blob([JSON.stringify(breakdown)], { type: JSON_MIME });
  await db.storage.from(CANVAS_ASSET_BUCKET).upload(path, body, { contentType: JSON_MIME, upsert: true });
}

const signedUrlOf = (db: Db, asset: Asset) => signStoredFile(db, BUCKET_BY_SOURCE[asset.source ?? 'upload'], asset.url ?? '', SIGNED_URL_TTL_S.providerInput);

export type BreakdownRef = { orgId: string; projectId: string; assetId: string };

const reachable = (asset: Asset | null, projectId: string): asset is Asset => !!asset?.url && (asset.projectId ?? projectId) === projectId;

export async function assetBreakdown(db: Db, ports: BreakdownPorts, ref: BreakdownRef): Promise<BreakdownAnswer> {
  const asset = await findAsset(db, ref);
  if (!reachable(asset, ref.projectId)) {
    return failed(BreakdownError.NotFound);
  }
  if (asset.type !== 'video') {
    return failed(BreakdownError.NotVideo);
  }

  const path = breakdownPath({ orgId: ref.orgId, projectId: asset.projectId, assetId: asset.id });
  const cached = await stored(db, path);
  if (cached) {
    return answered(asset.id, cached);
  }

  const url = await signedUrlOf(db, asset);
  if (!url) {
    return failed(BreakdownError.NotFound);
  }
  const screened = await ports.screen(url);
  if (!screened.ok) {
    return failed(BreakdownError.Refused, screened.error);
  }

  const breakdown = parseBreakdown(await ports.watch(url).catch(() => ''));
  if (!breakdown) {
    return failed(BreakdownError.Unreadable);
  }
  await store(db, path, breakdown).catch(() => undefined);
  return answered(asset.id, breakdown);
}

export function breakdownPorts(scope: { orgId: string; mode: ProjectMode }): BreakdownPorts {
  return {
    watch: async (url) => {
      const [{ llmText, llmVideoReviewerModel }, { withOrgContext }] = await Promise.all([import('$lib/server/llm'), import('$lib/server/ai-log')]);
      const ask = { prompt: BREAKDOWN_PROMPT, model: llmVideoReviewerModel(), upstream: { videoUrls: [url] }, label: BREAKDOWN_LABEL };
      return withOrgContext(scope.orgId, async () => (await llmText(ask)).text);
    },
    screen: async (url) => {
      const [{ screenModelReferences }, { ReferenceMedium }] = await Promise.all([import('$lib/server/moderation/model-input'), import('$lib/server/moderation/people')]);
      return screenModelReferences({ orgId: scope.orgId, mode: scope.mode, references: [{ medium: ReferenceMedium.Video, url }] });
    }
  };
}

export async function videoGrabber(db: Db, ref: BreakdownRef): Promise<GrabFrame | null> {
  const asset = await findAsset(db, ref);
  if (!reachable(asset, ref.projectId) || asset.type !== 'video') {
    return null;
  }
  const [url, bin] = await Promise.all([signedUrlOf(db, asset), ensureFfmpegPath()]);
  return url && bin ? ffmpegGrab(bin, url) : null;
}

export const breakdownReader = (db: Db, scope: { orgId: string; projectId: string; mode: ProjectMode }) => (assetId: string) =>
  assetBreakdown(db, breakdownPorts(scope), { orgId: scope.orgId, projectId: scope.projectId, assetId });
