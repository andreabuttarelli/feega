import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { DocMode } from '@feega/motion-core/motion/still';
import { frameOf, mediaElement, placeElement, type NewId, type Output } from './move-element';
import type { Fraction } from '$lib/layer-boxes';

export type PlacedLayer = { output: Output; box: Fraction };

const CENTRE = { x: 0.5, y: 0.5 };
const FIRST_FRAME = 0;

function boxed(doc: MotionDoc, clipId: string, box: Fraction): MotionDoc {
  const props = { x: box.left + box.width / 2, y: box.top + box.height / 2, width: box.width, height: box.height, fit: 'contain' };
  const tracks = doc.tracks.map((track) => ({ ...track, clips: track.clips.map((clip) => (clip.id === clipId ? { ...clip, props: { ...clip.props, ...props } } : clip)) }));
  return { ...doc, tracks };
}

export function layersFrame(base: Output, layers: readonly PlacedLayer[], newId: NewId): MotionDoc {
  const frame = frameOf(mediaElement(base), DocMode.Still, null, newId);
  return layers.reduce((doc, layer) => {
    const placed = placeElement(doc, mediaElement(layer.output, doc.fps), { at: CENTRE, frame: FIRST_FRAME }, newId);
    return placed.ok ? boxed(placed.doc, placed.clipId, layer.box) : doc;
  }, frame);
}
