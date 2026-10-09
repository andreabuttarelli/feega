import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import { AttachmentError, AttachmentKind } from '$lib/chat-attachments';
import ChatComposer from './ChatComposer.svelte';
import ChatAttachments from './ChatAttachments.svelte';
import { UploadStatus, type Upload } from './chat-uploads.svelte';

const upload = (over: Partial<Upload>): Upload => ({ id: 'u', name: 'logo.png', bytes: 2048, kind: AttachmentKind.Image, preview: 'blob:p', progress: 0.4, status: UploadStatus.Uploading, ...over });

describe('chat composer with attachments', () => {
  it('shows the attach button and a hidden file picker for images and documents', () => {
    const body = render(ChatComposer, { props: { value: '', onsend: () => {}, onstop: () => {}, onfiles: () => {} } }).body;

    expect(body).toContain('data-testid="chat-attach"');
    expect(body).toContain('aria-label="Attach files or images"');
    expect(body).toMatch(/type="file"[^>]*multiple/);
    expect(body).toContain('.pdf');
    expect(body).toContain('image/png');
  });

  it('without an upload handler there is no attach button', () => {
    const body = render(ChatComposer, { props: { value: '', onsend: () => {}, onstop: () => {} } }).body;

    expect(body).not.toContain('data-testid="chat-attach"');
  });
});

describe('attachment chips', () => {
  it('a chip shows thumbnail, name, size, progress and a remove button', () => {
    const body = render(ChatAttachments, { props: { items: [upload({})], onremove: () => {} } }).body;

    expect(body).toContain('src="blob:p"');
    expect(body).toContain('logo.png');
    expect(body).toContain('2 KB');
    expect(body).toContain('role="progressbar"');
    expect(body).toContain('aria-label="Remove logo.png"');
  });

  it('a refused chip says why', () => {
    const body = render(ChatAttachments, { props: { items: [upload({ status: UploadStatus.Failed, error: AttachmentError.Refused, detail: 'Refused: people', preview: null })], onremove: () => {} } }).body;

    expect(body).toContain('Refused: people');
    expect(body).toContain('role="alert"');
  });

  it('a chip on a sent message has no remove button and no progress', () => {
    const body = render(ChatAttachments, { props: { items: [upload({ status: UploadStatus.Ready, kind: AttachmentKind.Document, name: 'brief.pdf', preview: null })] } }).body;

    expect(body).toContain('brief.pdf');
    expect(body).not.toContain('progressbar');
    expect(body).not.toContain('Remove');
  });
});
