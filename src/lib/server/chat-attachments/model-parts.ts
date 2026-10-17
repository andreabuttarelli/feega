import sharp from 'sharp';
import type { ImagePart, TextPart } from 'ai';
import type { Db } from '$lib/server/db/client';
import { AttachmentKind, type ChatAttachment } from '$lib/chat-attachments';
import { findAssets, type Asset } from '$lib/server/repos/assets';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import type { BreakdownAnswer } from '$lib/server/video-reference';

export const MODEL_IMAGE_MAX_PX = 1568;
const JPEG_QUALITY = 85;

type Part = TextPart | ImagePart;

export type PlaceHint = (attachment: ChatAttachment) => string;
export type ReadBreakdown = (assetId: string) => Promise<BreakdownAnswer>;

type PartsCtx = { db: Db; hint: PlaceHint; breakdown: ReadBreakdown };

const READ_TOOL = 'read_video_reference';

function breakdownText(answer: BreakdownAnswer, assetId: string): string {
  return answer.ok ? answer.brief : `Its breakdown is not available: ${answer.message} You can retry with ${READ_TOOL} on asset ${assetId}.`;
}

async function modelImage(db: Db, asset: Asset): Promise<ImagePart | null> {
  const download = await db.storage.from(CANVAS_ASSET_BUCKET).download(asset.url ?? '');
  if (download.error || !download.data) {
    return null;
  }
  const resized = sharp(Buffer.from(await download.data.arrayBuffer())).resize(MODEL_IMAGE_MAX_PX, MODEL_IMAGE_MAX_PX, { fit: 'inside', withoutEnlargement: true });
  const jpeg = asset.mimeType === 'image/jpeg';
  const out = jpeg ? resized.jpeg({ quality: JPEG_QUALITY }) : resized.png();
  return { type: 'image', image: new Uint8Array(await out.toBuffer()), mediaType: jpeg ? 'image/jpeg' : 'image/png' };
}

const PARTS_OF: Record<AttachmentKind, (ctx: PartsCtx, a: ChatAttachment, asset: Asset) => Promise<Part[]>> = {
  [AttachmentKind.Document]: async (_ctx, a, asset) => [{ type: 'text', text: `### Attached file: ${a.name}\n\n${asset.content ?? ''}` }],
  [AttachmentKind.Image]: async ({ db, hint }, a, asset) => {
    const image = await modelImage(db, asset);
    const label: Part = { type: 'text', text: `Attached image: ${a.name} — project asset ${a.assetId}.${image ? '' : ' Its picture could not be loaded: you cannot see it.'} ${hint(a)}`.trim() };
    return image ? [label, image] : [label];
  },
  [AttachmentKind.Video]: async ({ hint, breakdown }, a) => {
    const label = `Attached reference video: ${a.name} — project asset ${a.assetId}. ${hint(a)}`.trim();
    return [{ type: 'text', text: `${label}\n${breakdownText(await breakdown(a.assetId), a.assetId)}` }];
  }
};

export async function userContent(db: Db, input: { orgId: string; text: string; attachments: ChatAttachment[]; hint: PlaceHint; breakdown: ReadBreakdown }): Promise<string | Part[]> {
  if (!input.attachments.length) {
    return input.text;
  }
  const assets = await findAssets(db, { orgId: input.orgId, assetIds: input.attachments.map((a) => a.assetId) });
  const parts = await Promise.all(
    input.attachments.map((a) => {
      const asset = assets.get(a.assetId);
      return asset ? PARTS_OF[a.kind]({ db, hint: input.hint, breakdown: input.breakdown }, a, asset) : Promise.resolve([]);
    })
  );
  return [{ type: 'text', text: input.text }, ...parts.flat()];
}

const NODE_TYPE_OF: Partial<Record<AttachmentKind, string>> = { [AttachmentKind.Video]: 'video' };

export const canvasPlaceHint = (projectId: string): PlaceHint => (a) =>
  `To place it on a canvas: create_node type "${NODE_TYPE_OF[a.kind] ?? 'image'}" with data {"prompt":"","assetId":"${a.assetId}","url":"/p/${projectId}/c/<canvasId>/assets/${a.assetId}","name":"${a.name}","mimeType":"${a.mimeType}"}, <canvasId> being the canvas you create it on.`;

export const motionPlaceHint: PlaceHint = (a) => `It is in this video's assets as id ${a.assetId}: use that asset id to place it in the video.`;
