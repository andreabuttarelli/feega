import { describe, expect, it } from 'vitest';
import { CANVAS_MENU, menuFor } from '$lib/canvas/selection-actions';
import { FRAME_MENU_IDS, frameMenuRun, frameLayers, frameSummaries } from './frame-menu';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { groupClips } from './group';
import { Command } from './shortcuts';
import { Edge } from './space';
import { Arrange } from './layer-order';

describe('the right-click menu inside a frame', () => {
  it('is the canvas menu table, limited to what a frame can run', () => {
    const ids = CANVAS_MENU.map((a) => a.id).filter((id) => FRAME_MENU_IDS.has(id));
    expect(ids).toEqual(['group', 'ungroup', 'duplicate', 'bring-front', 'send-back', 'align-left', 'align-center', 'align-right', 'align-top', 'align-middle', 'align-bottom', 'tidy-up', 'flip-horizontal', 'flip-vertical', 'use-as-mask', 'release-mask', 'select-matching', 'frame-selection', 'auto-layout', 'union', 'subtract', 'intersect', 'exclude', 'flatten', 'outline-stroke', 'outline-text', 'delete']);
  });

  it('aligns a single element to the frame', () => {
    const one = [{ id: 'c', type: 'clip', data: {} }];
    expect(menuFor(FRAME_MENU_IDS, one).map((a) => a.id)).toContain('align-left');
  });

  it('each item runs a frame command or an align edge', () => {
    expect(frameMenuRun('group')).toEqual({ command: Command.Group });
    expect(frameMenuRun('align-top')).toEqual({ edge: Edge.Top });
    expect(frameMenuRun('bring-front')).toEqual({ arrange: Arrange.Front });
    expect(frameMenuRun('send-back')).toEqual({ arrange: Arrange.Back });
    expect(frameMenuRun('flip-vertical')).toEqual({ command: Command.FlipVertical });
    expect(frameMenuRun('copy-id')).toBeNull();
  });
});

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

describe('what the frame menu knows about the layers', () => {
  const doc = ok(addClip(ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect' } }, 'a')), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'hi' } }, 'b'));

  it('names each layer under the pointer like the layers panel', () => {
    expect(frameLayers(doc, ['b', 'a', 'gone']).map((l) => l.id)).toEqual(['b', 'a']);
    expect(frameLayers(doc, ['a'])[0].label).toBeTruthy();
  });

  it('marks a group so Ungroup shows only for it', () => {
    let n = 0;
    const grouped = groupClips(doc, ['a', 'b'], () => `g${++n}`);
    const g = ok(grouped).tracks.flatMap((t) => t.clips)[0].id;
    expect(menuFor(FRAME_MENU_IDS, frameSummaries(ok(grouped), [g])).map((a) => a.id)).toContain('ungroup');
    expect(menuFor(FRAME_MENU_IDS, frameSummaries(doc, ['a'])).map((a) => a.id)).not.toContain('ungroup');
  });
});
