import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionComp } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { compBox, reframed } from './comp-frame';

function buttonComp(): MotionComp {
  const added = addClip({ ...newMotionDoc(MotionFormat.Landscape), width: 1000, height: 2000 }, { component: 'Shape', from: 0, durationInFrames: 30, props: { x: 0.5, y: 0.75, width: 0.2, height: 0.05 } }, 'pill');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return { name: 'Button', durationInFrames: 30, component: { name: 'Button' }, tracks: added.doc.tracks.filter((t) => t.clips.length) };
}

const PAGE = { width: 1000, height: 2000 };
const SET = { width: 400, height: 200 };
const rounded = (values: unknown[]) => values.map((v) => Number(Number(v).toFixed(6)));

describe('a main keeps its pixels when it moves between frames of different sizes', () => {
  it('measures the main in pixels of the frame that holds it', () => {
    expect(compBox(buttonComp(), PAGE)).toEqual({ left: 400, top: 1450, right: 600, bottom: 1550 });
  });

  it('moves the main to a smaller frame without stretching it', () => {
    const moved = reframed(buttonComp(), PAGE, SET, { x: 48 - 400, y: 48 - 1450 });
    const box = compBox(moved, SET)!;
    expect(rounded([box.left, box.top, box.right, box.bottom])).toEqual([48, 48, 248, 148]);
  });

  it('comes back to the same place it left', () => {
    const away = reframed(buttonComp(), PAGE, SET, { x: -352, y: -1402 });
    const back = reframed(away, SET, PAGE, { x: 352, y: 1402 });
    const pill = back.tracks[0].clips[0] as MotionClip;
    expect(rounded([pill.props.x, pill.props.y, pill.props.width, pill.props.height])).toEqual([0.5, 0.75, 0.2, 0.05]);
  });

  it('leaves a main alone when the frames match', () => {
    const comp = buttonComp();
    expect(reframed(comp, PAGE, PAGE)).toBe(comp);
  });
});
