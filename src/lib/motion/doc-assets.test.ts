import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { precompose } from './precomp';
import { referencedAssets } from './doc-assets';

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
