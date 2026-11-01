import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { Action } from '$lib/motion/actions';
import { barActions, headerActions } from '$lib/motion/clip-bar';
import { createComponent } from '$lib/motion/main-component';
import { frameSummaries } from '$lib/motion/frame-menu';
import { elementMenuIds, elementToolbarActions, frameBarActions, layerMenuActions } from './frame-inspector';
import { menuFor } from './selection-actions';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const plain = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'Hello' } }, 't'));
const made = must(createComponent(plain, ['t'], () => 'x', 'Button'));
const instanceId = made.tracks.flatMap((t) => t.clips)[0].id;

const header = (doc: MotionDoc, selection: string[]) => headerActions(barActions(doc, selection, frameBarActions(doc, selection))).groups.flat();
const contextMenu = (doc: MotionDoc, selection: string[]) => menuFor(elementMenuIds(doc, selection), frameSummaries(doc, selection)).map((a) => a.id);

describe('Go to main component is on every surface for an instance', () => {
  it('right-click on a Layers row', () => {
    expect(layerMenuActions(made, [instanceId])).toContain(Action.GoToMain);
  });

  it('right-click on the element on the canvas', () => {
    expect(contextMenu(made, [instanceId])).toContain('go-to-main');
  });

  it('the floating selection toolbar', () => {
    expect(elementToolbarActions(made, [instanceId])).toContain('go-to-main');
  });

  it('the More actions menu in the right bar header', () => {
    expect(header(made, [instanceId])).toContain(Action.GoToMain);
  });
});

describe('Go to main component hides for what is not an instance', () => {
  it('on every surface', () => {
    expect(layerMenuActions(plain, ['t'])).not.toContain(Action.GoToMain);
    expect(contextMenu(plain, ['t'])).not.toContain('go-to-main');
    expect(elementToolbarActions(plain, ['t'])).not.toContain('go-to-main');
    expect(header(plain, ['t'])).not.toContain(Action.GoToMain);
  });
});
