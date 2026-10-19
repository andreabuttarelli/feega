import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS, resolveColor } from '../brand';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '../doc';
import { addClip, addTrack, type OpResult } from '../timeline';
import { TrackKind } from '../components';
import { blobRows } from '../blob/pose';
import { displayListAt, ItemKind, type BlobItem } from './display-list';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const FROM = 10;
const card = must(addClip(must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'BrandBackground', from: 0, durationInFrames: 90 }, 'bg')), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.3, height: 0.3, fill: '#ff0000' } }, 'card'));
const tracked = must(addTrack(card, TrackKind.Visual, 'blob-track'));
const onTop = { ...tracked, tracks: [tracked.tracks.find((t) => t.id === 'blob-track')!, ...tracked.tracks.filter((t) => t.id !== 'blob-track')] };
const doc = must(addClip(onTop, { component: 'LiquidBlob', from: FROM, durationInFrames: 40, trackId: 'blob-track', props: { seed: 12 } }, 'drop'));
const clip = doc.tracks.flatMap((t) => t.clips).find((c) => c.id === 'drop') as MotionClip;

describe('liquid blob in the display list', () => {
  it('draws above everything beneath it, posed as the HTML engine bakes it', () => {
    const list = displayListAt(doc, FROM + 7, FEEGA_TOKENS);
    const blob = list.items.at(-1) as BlobItem;
    const rows = blobRows(clip, { width: doc.width, height: doc.height, fps: doc.fps }, (v) => resolveColor(v, FEEGA_TOKENS));

    expect(list.unsupported).toEqual([]);
    expect(list.items.map((i) => i.kind)).toEqual([ItemKind.Path, ItemKind.Path, ItemKind.Blob]);
    expect(blob).toMatchObject({ clip: 'drop', seed: 12, time: 7 / doc.fps, matrix: [1, 0, 0, 1, 0, 0] });
    expect(blob.row).toEqual(rows[7]);
  });

  it('draws nothing outside its time range', () => {
    expect(displayListAt(doc, FROM - 1, FEEGA_TOKENS).items.map((i) => i.kind)).toEqual([ItemKind.Path, ItemKind.Path]);
  });
});
