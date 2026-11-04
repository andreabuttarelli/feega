import { TrackKind, defaultProps } from './components';
import { newClip, type MotionDoc } from './doc';

export const WATERMARK_CLIP_ID = 'feega-watermark';
export const WATERMARK_TEXT = 'Made with Feega';

const TEXT_SIZE = 0.022;
const BOX_WIDTH = 0.3;
const BOX_HEIGHT = 0.036;
const MARGIN = 0.02;
const OPACITY = 0.6;
const WEIGHT = 500;
const COLOR = '#ffffff';

export function withWatermark(doc: MotionDoc): MotionDoc {
  if (doc.tracks.some((track) => track.clips.some((clip) => clip.id === WATERMARK_CLIP_ID))) {
    return doc;
  }

  const short = Math.min(doc.width, doc.height);
  const width = (BOX_WIDTH * short) / doc.width;
  const height = (BOX_HEIGHT * short) / doc.height;
  const clip = newClip({
    id: WATERMARK_CLIP_ID,
    from: 0,
    durationInFrames: doc.durationInFrames,
    component: 'Text',
    props: {
      ...defaultProps('Text'),
      text: WATERMARK_TEXT,
      size: TEXT_SIZE,
      weight: WEIGHT,
      color: COLOR,
      align: 'right',
      opacity: OPACITY,
      width,
      height,
      x: 1 - (MARGIN * short) / doc.width - width / 2,
      y: 1 - (MARGIN * short) / doc.height - height / 2
    }
  });

  return { ...doc, tracks: [{ id: WATERMARK_CLIP_ID, kind: TrackKind.Visual, name: '', clips: [clip] }, ...doc.tracks] };
}
