import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { fakeDb } from '$lib/server/db/fake-db';
import { AttachmentKind, attachedNote, type ChatAttachment } from '$lib/chat-attachments';
import { MODEL_IMAGE_MAX_PX, motionPlaceHint, userContent } from './model-parts';

const logo: ChatAttachment = { assetId: 'a-1', kind: AttachmentKind.Image, name: 'logo.png', mimeType: 'image/png', bytes: 10 };
const brief: ChatAttachment = { assetId: 'a-2', kind: AttachmentKind.Document, name: 'brief.pdf', mimeType: 'application/pdf', bytes: 10 };

const row = (id: string, over: Record<string, unknown>) => ({
  id, project_id: 'p-1', content: null, mime_type: 'image/png', bytes: 10, width: null, height: null, duration_s: null,
  source: 'upload', source_node_id: null, uncensored: false, created_at: '2026-10-09', ...over
});

describe('userContent', () => {
  it('senza allegati resta il testo', async () => {
    const { db } = fakeDb({});
    expect(await userContent(db, { orgId: 'org-1', text: 'ciao', attachments: [], hint: () => '' })).toBe('ciao');
  });

  it('documenti come testo con il nome, immagini come immagini ridotte con il loro asset id', async () => {
    const big = new Uint8Array(await sharp({ create: { width: 4000, height: 1000, channels: 4, background: '#f00' } }).png().toBuffer());
    const { db } = fakeDb(
      { assets: [row('a-1', { type: 'image', url: 'o/p/chat/u__logo.png' }), row('a-2', { type: 'document', url: 'o/p/chat/u__brief.pdf', content: '# Brief\n\nGreen bottles.' })] },
      { files: { 'o/p/chat/u__logo.png': big } }
    );

    const content = await userContent(db, { orgId: 'org-1', text: 'summarize and place', attachments: [brief, logo], hint: (a) => `place ${a.assetId}` });
    if (typeof content === 'string') {
      throw new Error('expected parts');
    }

    expect(content[0]).toEqual({ type: 'text', text: 'summarize and place' });
    expect(content[1]).toEqual({ type: 'text', text: '### Attached file: brief.pdf\n\n# Brief\n\nGreen bottles.' });
    expect((content[2] as { text: string }).text).toMatch(/^Attached image: logo\.png — project asset a-1\. place a-1 Its palette, by share of the picture: #ff0000 100%/);
    const image = content[3] as { type: string; image: Uint8Array; mediaType: string };
    expect(image.type).toBe('image');
    expect(image.mediaType).toBe('image/png');
    const meta = await sharp(Buffer.from(image.image)).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(MODEL_IMAGE_MAX_PX);
  });

  it('versus run1: an attached reference comes with its measured palette, so the video does not guess its colours', async () => {
    const red = new Uint8Array(await sharp({ create: { width: 200, height: 100, channels: 3, background: '#e0008a' } }).png().toBuffer());
    const { db } = fakeDb({ assets: [row('a-1', { type: 'image', url: 'o/p/chat/ref.png' })] }, { files: { 'o/p/chat/ref.png': red } });

    const content = await userContent(db, { orgId: 'org-1', text: 'like this', attachments: [logo], hint: () => '' });

    expect(JSON.stringify(content)).toContain('#e0008a 100%');
  });

  it('an image whose file cannot be read says so, instead of claiming a picture the model never gets', async () => {
    const { db } = fakeDb({ assets: [row('a-1', { type: 'image', url: 'o/p/chat/missing.png' })] }, { files: {} });

    const content = await userContent(db, { orgId: 'org-1', text: 'look', attachments: [logo], hint: () => '' });

    expect(JSON.stringify(content)).toContain('could not be loaded');
    expect(JSON.stringify(content)).not.toContain('"type":"image"');
  });
});

describe('motionPlaceHint', () => {
  it('versus run1: an attached app screenshot is shown as itself, large, one element at a time, never rebuilt small and dark', () => {
    const hint = motionPlaceHint(logo);

    expect(hint).toContain('a-1');
    expect(hint).toContain('Device3D');
    expect(hint).toMatch(/zoom/);
    expect(hint).toMatch(/never recreate_ui/);
  });
});

describe('attachedNote', () => {
  it('la cronologia nomina file e asset', () => {
    expect(attachedNote([logo, brief])).toBe('\n\n[Attached: logo.png (image, asset a-1); brief.pdf (document, asset a-2)]');
    expect(attachedNote([])).toBe('');
  });
});
