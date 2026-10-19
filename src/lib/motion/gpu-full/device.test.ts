import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { precompose } from '../precomp';
import { addClip, removeClips, setKeyframes, type OpResult } from '../timeline';
import { Ease } from '../design';
import { drawFrame, ItemKind, prepare, SCREEN_GAP, Unsupported } from './display-list';
import { DrawnKind, type DomRead } from './dom/read';
import { readClips } from './dom/custom';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const withUi = (() => {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 90, props: { text: 'Daily Loop' } }, 'title'));
  doc = must(precompose({ ...doc, durationInFrames: 90 }, ['title'], { comp: 'ui', clip: 'pc' }, 'App UI'));
  doc = must(removeClips(doc, ['pc']));
  return { ...doc, comps: { ...doc.comps, ui: { ...doc.comps.ui, frame: { width: 390, height: 848 } } } };
})();

const doc = must(addClip(withUi, { component: 'Device3D', from: 0, durationInFrames: 90, props: { screenComp: 'ui', device: 'phone-pro' } }, 'ph'));
const prepared = prepare(doc, FEEGA_TOKENS);
const canvas: DomRead = { drawn: [{ kind: DrawnKind.Layer, layer: 0, width: 1920, height: 1080, opacity: 1, matrix: [1, 0, 0, 1, 0, 0] }], gaps: [] };

describe('a device on the GPU', () => {
  it('waits for its three.js canvas and never draws its screen flat on the frame', () => {
    expect(drawFrame(prepared, 10)).toMatchObject({ items: [], unsupported: [{ clip: 'ph', component: 'Device3D', reason: Unsupported.Unread }] });
  });

  it('draws the canvas the HTML engine rendered as a layer, and names the screen it cannot place yet', () => {
    const list = drawFrame(prepared, 10, new Map([['ph', canvas]]));

    expect(list.unsupported).toEqual([{ clip: 'ph', component: 'Device3D', reason: Unsupported.Dom, detail: SCREEN_GAP }]);
    expect(list.items).toMatchObject([{ kind: ItemKind.Layer, clip: 'ph', source: 'ph:0' }]);
  });

  it('leaves its own keyframes to the three.js runtime', () => {
    const turning = must(setKeyframes(doc, 'ph', 'objectRotateY', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 60, value: 40, ease: Ease.Linear }]));

    expect(drawFrame(prepare(turning, FEEGA_TOKENS), 10, new Map([['ph', canvas]])).unsupported.map((g) => g.reason)).toEqual([Unsupported.Dom]);
  });

  it('reads the device and composes its screen with it', () => {
    const { read, composed } = readClips(prepared.doc);

    expect(read).toEqual(['ph']);
    expect([...composed].sort()).toEqual(['ph', ...prepared.doc.tracks.flatMap((t) => t.clips).map((c) => c.id).filter((id) => id.startsWith('ph-scr0__'))].sort());
  });
});
