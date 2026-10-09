import { describe, expect, it } from 'vitest';
import {
  AttachmentError,
  AttachmentKind,
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_ATTACHMENT_MAX_COUNT,
  attachmentNameOf,
  attachmentVerdict,
  chatAttachmentPrefix,
  formatBytes,
  parseAttachments
} from './chat-attachments';

describe('attachmentVerdict', () => {
  it('accetta immagini e documenti della lista', () => {
    expect(attachmentVerdict('image/png', 'logo.png', 10)).toEqual({ ok: true, kind: AttachmentKind.Image });
    expect(attachmentVerdict('application/pdf', 'brief.pdf', 10)).toEqual({ ok: true, kind: AttachmentKind.Document });
    expect(attachmentVerdict('', 'deck.pptx', 10)).toEqual({ ok: true, kind: AttachmentKind.Document });
    expect(attachmentVerdict('text/csv', 'rows.csv', 10)).toEqual({ ok: true, kind: AttachmentKind.Document });
  });

  it('rifiuta formati fuori lista, file vuoti e oltre il tetto', () => {
    expect(attachmentVerdict('video/mp4', 'clip.mp4', 10)).toEqual({ ok: false, error: AttachmentError.Unsupported });
    expect(attachmentVerdict('application/zip', 'a.zip', 10)).toEqual({ ok: false, error: AttachmentError.Unsupported });
    expect(attachmentVerdict('image/png', 'a.png', 0)).toEqual({ ok: false, error: AttachmentError.Empty });
    expect(attachmentVerdict('image/png', 'a.png', CHAT_ATTACHMENT_MAX_BYTES + 1)).toEqual({ ok: false, error: AttachmentError.TooLarge });
  });
});

describe('parseAttachments', () => {
  it('tiene solo id validi e taglia al massimo per messaggio', () => {
    const ids = Array.from({ length: CHAT_ATTACHMENT_MAX_COUNT + 3 }, (_, i) => `a-${i}`);
    expect(parseAttachments(ids)).toHaveLength(CHAT_ATTACHMENT_MAX_COUNT);
    expect(parseAttachments(['x', 3, '', null])).toEqual(['x']);
    expect(parseAttachments('nope')).toEqual([]);
  });
});

describe('percorsi', () => {
  it('il nome torna dal percorso, senza uuid', () => {
    const path = `${chatAttachmentPrefix('o', 'p')}0b9c-uuid__brief final.pdf`;
    expect(attachmentNameOf(path)).toBe('brief final.pdf');
  });

  it('formatBytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
