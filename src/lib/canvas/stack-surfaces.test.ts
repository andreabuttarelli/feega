import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { Action } from '$lib/motion/actions';
import { barActions, headerActions } from '$lib/motion/clip-bar';
import { frameSummaries } from '$lib/motion/frame-menu';
import { wrapInStack } from '$lib/motion/layout/ops';
import { elementMenuIds, elementToolbarActions, frameBarActions, layerMenuActions } from './frame-inspector';
import { canvasMenuIds, menuFor } from './selection-actions';
import { DocNodeType, FrameKind } from './motion-node';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const texted = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'Hello', x: 0.5, y: 0.5, width: 0.4, height: 0.1 } }, 't'));
const stacked = must(wrapInStack(texted, ['t'], 'stack', 'lane'));

const header = (doc: MotionDoc, selection: string[]) => headerActions(barActions(doc, selection, frameBarActions(doc, selection))).groups.flat();
const contextMenu = (doc: MotionDoc, selection: string[]) => menuFor(elementMenuIds(doc, selection), frameSummaries(doc, selection)).map((a) => a.id);

describe('Wrap with stack is on every surface for a text', () => {
  it('right-click on a Layers row', () => {
    expect(layerMenuActions(texted, ['t'])).toContain(Action.WrapStack);
  });

  it('right-click on the element on the canvas', () => {
    expect(contextMenu(texted, ['t'])).toContain('wrap-stack');
  });

  it('the floating selection toolbar', () => {
    expect(elementToolbarActions(texted, ['t'])).toContain('wrap-stack');
  });

  it('the More actions menu in the right bar header', () => {
    expect(header(texted, ['t'])).toContain(Action.WrapStack);
  });

  it('a free text on the canvas, from the canvas menu', () => {
    const free = [{ id: 'n1', type: DocNodeType.Element, data: { kind: FrameKind.Element } }];
    expect(menuFor(canvasMenuIds(1), free).map((a) => a.id)).toContain('wrap-stack');
  });
});

describe('Remove stack is on every surface for a stack, and only for a stack', () => {
  it('shows for the stack', () => {
    expect(layerMenuActions(stacked, ['stack'])).toContain(Action.RemoveStack);
    expect(contextMenu(stacked, ['stack'])).toContain('remove-stack');
    expect(elementToolbarActions(stacked, ['stack'])).toContain('remove-stack');
    expect(header(stacked, ['stack'])).toContain(Action.RemoveStack);
  });

  it('hides for a text', () => {
    expect(layerMenuActions(texted, ['t'])).not.toContain(Action.RemoveStack);
    expect(contextMenu(texted, ['t'])).not.toContain('remove-stack');
    expect(elementToolbarActions(texted, ['t'])).not.toContain('remove-stack');
    expect(header(texted, ['t'])).not.toContain(Action.RemoveStack);
  });
});

describe('the canvas Stack tiles arranger keeps no ⇧A', () => {
  it('is no longer called Stack', () => {
    const tiles = [{ id: 'a', type: 'image', data: {} }, { id: 'b', type: 'image', data: {} }];
    const labels = menuFor(canvasMenuIds(2), tiles).map((a) => a.label);
    expect(labels).not.toContain('Stack');
    expect(labels).not.toContain('Wrap with stack');
  });
});
