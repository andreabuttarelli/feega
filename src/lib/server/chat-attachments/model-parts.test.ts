import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { fakeDb } from '$lib/server/db/fake-db';
import { AttachmentKind, attachedNote, type ChatAttachment } from '$lib/chat-attachments';
import { MODEL_IMAGE_MAX_PX, canvasPlaceHint, userContent } from './model-parts';
import { BreakdownError } from '$lib/server/video-reference';

const logo: ChatAttachment = { assetId: 'a-1', kind: AttachmentKind.Image, name: 'logo.png', mimeType: 'image/png', bytes: 10 };
const brief: ChatAttachment = { assetId: 'a-2', kind: AttachmentKind.Document, name: 'brief.pdf', mimeType: 'application/pdf', bytes: 10 };

const reel: ChatAttachment = { assetId: 'v-1', kind: AttachmentKind.Video, name: 'reel.mp4', mimeType: 'video/mp4', bytes: 10 };
const unread = async () => ({ ok: false as const, error: BreakdownError.Unreadable, message: 'The video could not be read.' });

const row = (id: string, over: Record<string, unknown>) => ({
  id, project_id: 'p-1', content: null, mime_type: 'image/png', bytes: 10, width: null, height: null, duration_s: null,
  source: 'upload', source_node_id: null, uncensored: false, created_at: '2026-10-09', ...over
});

describe('userContent', () => {
  it('senza allegati resta il testo', async () => {
    const { db } = fakeDb({});
    expect(await userContent(db, { orgId: 'org-1', text: 'ciao', attachments: [], hint: () => '', breakdown: unread })).toBe('ciao');
  });

  it('documenti come testo con il nome, immagini come immagini ridotte con il loro asset id', async () => {
    const big = new Uint8Array(await sharp({ create: { width: 4000, height: 1000, channels: 4, background: '#f00' } }).png().toBuffer());
    const { db } = fakeDb(
      { assets: [row('a-1', { type: 'image', url: 'o/p/chat/u__logo.png' }), row('a-2', { type: 'document', url: 'o/p/chat/u__brief.pdf', content: '# Brief\n\nGreen bottles.' })] },
      { files: { 'o/p/chat/u__logo.png': big } }
    );

    const content = await userContent(db, { orgId: 'org-1', text: 'summarize and place', attachments: [brief, logo], hint: (a) => `place ${a.assetId}`, breakdown: unread });
    if (typeof content === 'string') {
      throw new Error('expected parts');
    }

    expect(content[0]).toEqual({ type: 'text', text: 'summarize and place' });
    expect(content[1]).toEqual({ type: 'text', text: '### Attached file: brief.pdf\n\n# Brief\n\nGreen bottles.' });
    expect(content[2]).toEqual({ type: 'text', text: 'Attached image: logo.png — project asset a-1. place a-1' });
    const image = content[3] as { type: string; image: Uint8Array; mediaType: string };
    expect(image.type).toBe('image');
    expect(image.mediaType).toBe('image/png');
    const meta = await sharp(Buffer.from(image.image)).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(MODEL_IMAGE_MAX_PX);
  });

  it('an image whose file cannot be read says so, instead of claiming a picture the model never gets', async () => {
    const { db } = fakeDb({ assets: [row('a-1', { type: 'image', url: 'o/p/chat/missing.png' })] }, { files: {} });

    const content = await userContent(db, { orgId: 'org-1', text: 'look', attachments: [logo], hint: () => '', breakdown: unread });

    expect(JSON.stringify(content)).toContain('could not be loaded');
    expect(JSON.stringify(content)).not.toContain('"type":"image"');
  });
});

describe('a reference video', () => {
  it('reaches the model as its breakdown: script, scenes, UI, transitions', async () => {
    const { db } = fakeDb({ assets: [row('v-1', { type: 'video', url: 'o/p/chat/u__reel.mp4', mime_type: 'video/mp4' })] });
    const read = async (assetId: string) => ({ ok: true as const, assetId, breakdown: {} as never, brief: 'Reference video breakdown (6 s). UI: prompt input' });

    const content = await userContent(db, { orgId: 'org-1', text: 'make one like this', attachments: [reel], hint: () => 'placed', breakdown: read });

    expect(content).toEqual([
      { type: 'text', text: 'make one like this' },
      { type: 'text', text: 'Attached reference video: reel.mp4 — project asset v-1. placed\nReference video breakdown (6 s). UI: prompt input' }
    ]);
  });

  it('that could not be read says so and names the tool to retry', async () => {
    const { db } = fakeDb({ assets: [row('v-1', { type: 'video', url: 'o/p/chat/u__reel.mp4', mime_type: 'video/mp4' })] });

    const content = await userContent(db, { orgId: 'org-1', text: 'x', attachments: [reel], hint: () => '', breakdown: unread });

    expect(JSON.stringify(content)).toContain('The video could not be read.');
    expect(JSON.stringify(content)).toContain('read_video_reference');
  });
});

describe('canvasPlaceHint', () => {
  it('places a reference video as a video node, an image as an image node', () => {
    expect(canvasPlaceHint('p-1')(reel)).toContain('create_node type "video"');
    expect(canvasPlaceHint('p-1')(logo)).toContain('create_node type "image"');
  });
});

describe('attachedNote', () => {
  it('la cronologia nomina file e asset', () => {
    expect(attachedNote([logo, brief])).toBe('\n\n[Attached: logo.png (image, asset a-1); brief.pdf (document, asset a-2)]');
    expect(attachedNote([])).toBe('');
  });
});
