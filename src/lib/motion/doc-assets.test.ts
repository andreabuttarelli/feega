import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { precompose } from '@feega/motion-core/motion/precomp';
import { mayUseAssets, mentionedIds, referencedAssets } from './doc-assets';

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const MUSIC = { id: 'a1f0c3d2-music', kind: 'audio' as const, name: 'music' };
const PHOTO = { id: 'b7e9d1aa-photo', kind: 'image' as const, name: 'site image' };
const UNUSED = { id: 'c3d4e5f6-unused', kind: 'image' as const, name: 'unused' };

describe('referencedAssets', () => {
  it('lists every asset the video uses, inside scenes too, and only those', () => {
    let doc = must(addClip(newMotionDoc(MotionFormat.Vertical), { component: 'Audio', from: 0, durationInFrames: 90, props: { assetId: MUSIC.id } }, 'm'));
    doc = must(addClip(doc, { component: 'Image', from: 0, durationInFrames: 90, props: { assetId: PHOTO.id } }, 'p'));
    doc = must(precompose({ ...doc, assets: [MUSIC] }, ['p'], { comp: 'scene', clip: 's' }, 'Scene'));

    expect(referencedAssets(doc, [MUSIC, PHOTO, UNUSED])).toEqual([MUSIC, PHOTO]);
  });
});

describe('mayUseAssets', () => {
  it('a doc that names no asset needs no asset lookup', () => {
    expect(mayUseAssets(newMotionDoc(MotionFormat.Vertical))).toBe(false);
    expect(mayUseAssets(must(addClip(newMotionDoc(MotionFormat.Vertical), { component: 'Image', from: 0, durationInFrames: 30, props: { assetId: '1ddda28a-a52d-4463-9b43-e4c82c5787fe' } }, 'p')))).toBe(true);
  });
});

describe('reading a large doc against a large library', () => {
  const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const library = Array.from({ length: 300 }, (_, i) => ({ id: uuid(i), kind: 'image' as const, name: `photo ${i}` }));

  it('writes the doc out once, not once per call or per library asset', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Vertical), { component: 'Image', from: 0, durationInFrames: 90, props: { assetId: uuid(7) } }, 'p'));
    const written = vi.spyOn(JSON, 'stringify');

    const used = referencedAssets(doc, library).map((a) => a.id);
    const ids = mentionedIds(doc);
    const docWrites = written.mock.calls.filter(([value]) => Array.isArray(value) && value[0] === doc.tracks).length;
    written.mockRestore();

    expect(used).toEqual([uuid(7)]);
    expect(ids).toEqual([uuid(7)]);
    expect(docWrites).toBe(1);
  });
});
