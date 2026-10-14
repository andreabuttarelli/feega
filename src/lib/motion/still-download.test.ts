import { describe, expect, it } from 'vitest';
import { attachmentUrl } from './still-model';

const SIGNED = 'https://x.supabase.co/storage/v1/object/sign/canvas-assets/o/p/stills/a.png?token=abc';

describe('the link that downloads an exported image', () => {
  it('asks storage to send the file as an attachment, so a cross-origin link saves instead of opening a tab', () => {
    const url = new URL(attachmentUrl(SIGNED, 'Poster type grid.png'));

    expect(url.searchParams.get('download')).toBe('Poster type grid.png');
    expect(url.searchParams.get('token')).toBe('abc');
  });
});
