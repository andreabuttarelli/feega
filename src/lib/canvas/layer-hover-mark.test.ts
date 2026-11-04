// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { wrapInStack } from '$lib/motion/layout/ops';
import { framePicker } from './frame-pick';
import { layerHoverMark } from './layer-hover-mark';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const text = (x: number) => ({ component: 'Text', from: 0, props: { text: 'Ciao', size: 0.09, x, y: 0.4, width: 0.2, height: 0.12 } });
const loose = must(addClip(must(addClip(must(addClip({ ...newMotionDoc(MotionFormat.Landscape), width: 1000, height: 700 }, text(0.25), 'a')), text(0.5), 'b')), text(0.75), 'c'));
const doc = must(wrapInStack(loose, ['a', 'b', 'c'], 'stack', 'lane'));
const picker = framePicker({ doc, tokens: FEEGA_TOKENS, assets: {} });
const space = picker.spaceOf({ x: 220, y: 100, w: 1000, h: 700 }, 0);
const at = { nodeId: 'frame', picker, space };

describe('hovering a layer row outlines that layer where the canvas draws it', () => {
  it('a child of a stack is outlined at its laid-out box, not at its stored props', () => {
    const mark = layerHoverMark({ nodeId: 'frame', id: 'b' }, 'frame', at);

    expect(mark?.clip).toBe('b');
    expect(mark?.quad).toEqual(picker.outlineQuad('b', space));
  });

  it('a row of another frame outlines nothing here', () => {
    expect(layerHoverMark({ nodeId: 'other', id: 'b' }, 'frame', at)).toBeNull();
  });

  it('the frame row itself rings the tile, not a layer', () => {
    expect(layerHoverMark({ nodeId: 'frame', id: 'frame' }, 'frame', at)).toBeNull();
  });

  it('the canvas draws the mark for a row hovered in the Layers panel', () => {
    const flow = readFileSync('src/lib/components/canvas/gpu/GpuFlow.svelte', 'utf8');

    expect(flow).toMatch(/layerHoverMark\(layersSource\.hovered/);
    expect(flow).toMatch(/data-testid="frame-layer-hover-box"/);
  });
});
