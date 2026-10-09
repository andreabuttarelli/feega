import { describe, expect, it } from 'vitest';
import { AttachmentKind } from '$lib/chat-attachments';
import { PrefillMode, briefPrefill } from './chat-prefill';

const file = { assetId: 'a1', kind: AttachmentKind.Document, name: 'brief.pdf', mimeType: 'application/pdf', bytes: 9 };

describe('the brief from /app becomes the first sent turn', () => {
  it('sends the text with the files attached', () => {
    expect(briefPrefill('A logo reveal', [file], 7)).toEqual({ text: 'A logo reveal', at: 7, mode: PrefillMode.Send, attachments: [file] });
  });
});
