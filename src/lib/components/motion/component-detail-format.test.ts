import { describe, expect, it } from 'vitest';
import { MotionFormat } from '$lib/motion/doc';
import { builtinTemplate } from '$lib/motion/template/builtins';
import { Edits, draftToAdd, starterDoc } from '$lib/motion/template/catalogue';

const POSTER = 'builtin:poster-type-grid';

function portrait() {
  const made = starterDoc(builtinTemplate(POSTER)!, MotionFormat.Vertical, () => 'd1');
  return made.ok ? { doc: made.doc, clipId: made.clipId } : null;
}

describe('the draft a library card adds', () => {
  it('picked in another format than the library opened on, it is added in that format', () => {
    expect(draftToAdd(portrait(), Edits.None, MotionFormat.Vertical, MotionFormat.Landscape)).not.toBeNull();
  });

  it('untouched and in the opening format, the template adds as it ships', () => {
    expect(draftToAdd(portrait(), Edits.None, MotionFormat.Landscape, MotionFormat.Landscape)).toBeNull();
  });

  it('edited, it is added with the edits', () => {
    expect(draftToAdd(portrait(), Edits.Some, MotionFormat.Landscape, MotionFormat.Landscape)).not.toBeNull();
  });
});

