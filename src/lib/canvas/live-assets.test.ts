import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { imageInFrame } from './image-in-frame';
import { missingAssets } from './live-assets';

const PICKED = '0b7c1f2e-4d5a-4e6b-8c9d-0123456789ab';
const KNOWN = '1c8d2a3f-5e6b-4f7c-9dae-123456789abc';
const urlOf = (id: string) => `/assets/${id}`;

function ellipseFilledWith(assetId: string): MotionDoc {
  const placed = imageInFrame(newMotionDoc(MotionFormat.Landscape), { assetId: KNOWN, name: 'a.png', width: 10, height: 10 });
  const doc = placed.ok ? placed.doc : newMotionDoc(MotionFormat.Landscape);
  const [track] = doc.tracks;
  const ellipse = { ...track.clips[0], id: 'ellipse1', component: 'Shape' as const, props: { shape: 'ellipse', fills: [{ type: 'image', assetId, visible: true }] } };
  return { ...doc, tracks: [{ ...track, clips: [...track.clips, ellipse] }] };
}

describe('missingAssets', () => {
  it('gives a url for an image fill picked after the frame loaded', () => {
    expect(missingAssets(ellipseFilledWith(PICKED), { [KNOWN]: '/signed/known' }, urlOf)).toEqual({ [PICKED]: `/assets/${PICKED}` });
  });

  it('is null when every asset the frame uses already has a url', () => {
    expect(missingAssets(ellipseFilledWith(KNOWN), { [KNOWN]: '/signed/known' }, urlOf)).toBeNull();
  });
});
