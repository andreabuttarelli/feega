import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { VideoControl, controlShown } from '@feega/motion-core/motion/still';
import { EditMode, startMode } from './edit-mode';

const video = newMotionDoc(MotionFormat.Landscape);
const still = { ...video, still: { frame: 0 } };

describe('which video controls a frame shows', () => {
  it('a still design frame shows no video control at all', () => {
    for (const control of Object.values(VideoControl)) {
      expect(controlShown(still, control)).toBe(false);
    }
  });

  it('a motion frame shows every video control', () => {
    for (const control of Object.values(VideoControl)) {
      expect(controlShown(video, control)).toBe(true);
    }
  });
});

describe('the edit mode a frame opens in', () => {
  it('a still frame opens in Design even when Motion was the last mode, since it has no switch back', () => {
    expect(startMode(still, EditMode.Motion)).toBe(EditMode.Design);
  });

  it('a motion frame opens in Design when no mode was ever chosen', () => {
    expect(startMode(video, null)).toBe(EditMode.Design);
  });

  it('a motion frame opens in the last mode used', () => {
    expect(startMode(video, EditMode.Motion)).toBe(EditMode.Motion);
    expect(startMode(video, EditMode.Design)).toBe(EditMode.Design);
  });
});
