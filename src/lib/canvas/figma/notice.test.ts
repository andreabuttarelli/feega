import { describe, expect, it } from 'vitest';
import { ImagesOutcome } from './fetch-images';
import { figmaNotice } from './notice';

const base = { skipped: [] as string[], images: 0, outcome: null as ImagesOutcome | null };

describe('the notice after a Figma paste', () => {
  it('stays silent when nothing was approximated', () => {
    expect(figmaNotice(base)).toBeNull();
  });

  it('is one short line, not the list of items', () => {
    const notice = figmaNotice({ ...base, skipped: ['font Foo replaced by the default', 'path of A', 'path of B'] })!;
    expect(notice.summary).toBe('Pasted from Figma: 3 approximations.');
  });

  it('groups the items by kind with counts', () => {
    const notice = figmaNotice({ ...base, skipped: ['font Foo replaced by the default', 'font Bar replaced by the default', 'path of A'] })!;
    expect(notice.groups.map((g) => [g.label, g.items.length])).toEqual([
      ['Fonts', 2],
      ['Other', 1]
    ]);
  });

  it('says once that images are placeholders and how to fill them when there is no token', () => {
    const notice = figmaNotice({ ...base, images: 12, outcome: ImagesOutcome.NoToken, skipped: ['path of A'] })!;
    expect(notice.summary).toBe('Pasted from Figma: 1 approximation. 12 images are grey placeholders: add a Figma token in Settings to import them.');
    expect(notice.needsToken).toBe(true);
  });

  it('does not mention images that were filled', () => {
    expect(figmaNotice({ ...base, images: 12, outcome: ImagesOutcome.Filled })).toBeNull();
  });

  it('does not mention images while they are still loading', () => {
    expect(figmaNotice({ ...base, images: 12, outcome: null })).toBeNull();
  });

  it('says images failed to load', () => {
    const notice = figmaNotice({ ...base, images: 1, outcome: ImagesOutcome.Failed })!;
    expect(notice.summary).toBe('Pasted from Figma: 1 image could not be loaded and stays a grey placeholder.');
    expect(notice.needsToken).toBe(false);
  });
});
