import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { Align, Direction, Justify, TrackType } from '@feega/motion-core/motion/layout/auto-layout';
import { setAutoLayout, setLayoutItem, wrapInStack } from '$lib/motion/layout/ops';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import StackSection from './StackSection.svelte';
import StackSettingsPanel from './StackSettingsPanel.svelte';


function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const row = (() => {
  let doc = newMotionDoc(MotionFormat.Square);
  doc = must(addClip(doc, { component: 'Shape', from: 0, props: { shape: 'rect', x: 0.2, y: 0.5, width: 0.1, height: 0.1 } }, 'a'));
  doc = must(addClip(doc, { component: 'Shape', from: 0, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.1, height: 0.1 } }, 'b'));
  doc = must(addClip(doc, { component: 'Shape', from: 0, props: { shape: 'rect' } }, 'plain'));
  return must(wrapInStack(doc, ['a', 'b'], 'box', 'lane'));
})();

const clip = (doc: MotionDoc, id: string) => findClip(doc, id)!.clip;
const section = (doc: MotionDoc, id: string) => render(StackSection, { props: { doc, clip: clip(doc, id), commit: () => {} } }).body;
const settings = (doc: MotionDoc, id: string) => {
  const stack = clip(doc, id);
  return stack.autoLayout ? render(StackSettingsPanel, { props: { doc, clip: { ...stack, autoLayout: stack.autoLayout }, commit: () => {} } }).body : '';
};
const html = (doc: MotionDoc, id: string, advanced = false) => section(doc, id) + (advanced ? settings(doc, id) : '');

describe('the stack section', () => {
  it('a stack shows direction, alignment, gap and padding, and stretch in its advanced settings', () => {
    const body = html(row, 'box');
    expect(body).not.toContain('data-testid="auto-layout-stretch"');
    expect(html(row, 'box', true)).toContain('data-testid="auto-layout-stretch"');
    for (const id of ['auto-layout-align', 'auto-layout-gap', 'auto-layout-padding-x', 'auto-layout-padding-y', 'stack-clip-content']) {
      expect(body).toContain(`data-testid="${id}"`);
    }
    expect(body).toMatch(/aria-label="Horizontal"[^>]*aria-checked="true"|aria-checked="true"[^>]*aria-label="Horizontal"/);
    expect(body).not.toContain('auto-layout-leave');
  });

  it('marks the alignment spot the layout uses, and space between as an Auto gap', () => {
    expect(html(row, 'box')).toMatch(/aria-label="Align start start"[^>]*aria-pressed="true"/);
    const spread = html(must(setAutoLayout(row, 'box', { justify: Justify.SpaceBetween })), 'box');
    expect(spread).toMatch(/<option[^>]*value="auto"[^>]*selected/);
    expect(spread).toContain('data-testid="auto-layout-gap" data-mode="auto"');
    expect(spread).toContain('placeholder="Auto"');
  });

  it.each([
    [Justify.SpaceAround, 'auto-layout-space-around'],
    [Justify.SpaceEvenly, 'auto-layout-space-evenly']
  ])('marks %s as pressed', (justify, testid) => {
    expect(html(must(setAutoLayout(row, 'box', { justify })), 'box', true)).toMatch(new RegExp(`aria-pressed="true"[^>]*data-testid="${testid}"|data-testid="${testid}"[^>]*aria-pressed="true"`));
  });

  it('a child offers absolute, reorder and leaving', () => {
    const body = html(row, 'a');
    for (const id of ['auto-layout-absolute', 'auto-layout-leave']) {
      expect(body).toContain(`data-testid="${id}"`);
    }
    expect(body).not.toContain('auto-layout-gap');
  });

  it('a lone child offers no reorder, since there is nowhere to move it', () => {
    let doc = newMotionDoc(MotionFormat.Square);
    doc = must(addClip(doc, { component: 'Shape', from: 0, props: { shape: 'rect' } }, 'only'));
    const body = html(must(wrapInStack(doc, ['only'], 'box', 'lane')), 'only');

    expect(body).toContain('data-testid="auto-layout-leave"');
    expect(body).not.toContain('aria-label="Move earlier"');
    expect(body).not.toContain('aria-label="Move later"');
  });

  it('a child among siblings offers both reorder buttons', () => {
    const body = html(row, 'a');

    expect(body).toContain('aria-label="Move earlier"');
    expect(body).toContain('aria-label="Move later"');
  });

  it('a child shows W and H chips with their mode beside the value', () => {
    const body = html(row, 'a');
    expect(body).toMatch(/data-testid="stack-unit-width"[^>]*>Fixed/);
    expect(body).toContain('data-testid="stack-size-width"');
    expect(body).toContain('data-testid="stack-align-self"');
  });

  it('padding is one value until it differs per side', () => {
    const even = html(row, 'box');
    expect(even).toContain('data-testid="auto-layout-padding-sides"');
    expect(even).not.toContain('data-testid="auto-layout-padding-top"');
    const uneven = html(must(setAutoLayout(row, 'box', { padding: { top: 8, right: 0, bottom: 0, left: 0 } })), 'box');
    expect(uneven).toContain('data-testid="auto-layout-padding-top"');
    expect(uneven).not.toContain('data-testid="auto-layout-padding-x"');
  });

  it('absolute is a labelled toggle: Ignore auto layout', () => {
    expect(html(row, 'a')).toMatch(/type="checkbox"[^>]*data-testid="auto-layout-absolute"[\s\S]*?Ignore auto layout/);
    expect(html(row, 'a')).not.toContain('data-segmented="Absolute position"');
  });

  it('a plain rectangle shows nothing: Wrap with stack makes a stack', () => {
    const body = html(row, 'plain');
    expect(body).not.toContain('data-testid="auto-layout-add"');
    expect(body).not.toContain('Width sizing');
  });

  it('marks stretch when the stack stretches its children', () => {
    expect(html(must(setAutoLayout(row, 'box', { align: Align.Stretch })), 'box', true)).toMatch(/aria-pressed="true"[^>]*data-testid="auto-layout-stretch"|data-testid="auto-layout-stretch"[^>]*aria-pressed="true"/);
  });
});

describe('grid fields', () => {
  const grid = must(setAutoLayout(row, 'box', { direction: Direction.Grid, columnTracks: [{ type: TrackType.Fixed, value: 120 }, { type: TrackType.Hug, value: 0 }] }));

  it('a grid shows its tracks and auto flow', () => {
    const body = html(grid, 'box', true);
    expect(body).toMatch(/data-testid="auto-layout-column-tracks"[^>]*value="120 hug"|value="120 hug"[^>]*data-testid="auto-layout-column-tracks"/);
    for (const id of ['auto-layout-row-tracks', 'auto-layout-auto-flow']) {
      expect(body).toContain(`data-testid="${id}"`);
    }
  });

  it('a grid child shows spans and cell alignment', () => {
    const body = html(grid, 'a');
    for (const id of ['auto-layout-column-span', 'auto-layout-row-span', 'auto-layout-cell-x', 'auto-layout-cell-y']) {
      expect(body).toContain(`data-testid="${id}"`);
    }
    expect(html(row, 'a')).not.toContain('auto-layout-column-span');
  });
});

describe('baseline', () => {
  it('a row offers baseline alignment and marks it', () => {
    expect(html(must(setAutoLayout(row, 'box', { align: Align.Baseline })), 'box', true)).toMatch(/aria-pressed="true"[^>]*data-testid="auto-layout-baseline"|data-testid="auto-layout-baseline"[^>]*aria-pressed="true"/);
    expect(html(must(setAutoLayout(row, 'box', { direction: Direction.Vertical })), 'box', true)).not.toContain('auto-layout-baseline');
  });
});

describe('niche settings live in the popover, not in the section', () => {
  it('names canvas stacking and strokes included only in the popover', () => {
    expect(section(row, 'box')).not.toContain('auto-layout-first-on-top');
    expect(section(row, 'box')).not.toContain('auto-layout-strokes-included');
    expect(settings(row, 'box')).toContain('First on top');
    expect(settings(row, 'box')).toContain('Last on top');
    expect(settings(row, 'box')).toContain('Canvas stacking');
  });
});

describe('padding chips', () => {
  it('shows two chips for even padding and four sides, left first, once they differ', () => {
    expect(section(row, 'box')).toContain('data-view="axes"');
    const uneven = section(must(setAutoLayout(row, 'box', { padding: { top: 8, right: 0, bottom: 0, left: 4 } })), 'box');
    expect(uneven).toContain('data-view="sides"');
    const order = ['left', 'top', 'right', 'bottom'].map((side) => uneven.indexOf(`data-testid="auto-layout-padding-${side}"`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe('min and max', () => {
  it('shows a set limit as a chip with its unit and a clear button', () => {
    const capped = must(setLayoutItem(row, 'a', { maxWidthPercent: 50, minHeight: 20 }));
    const body = section(capped, 'a');
    expect(body).toMatch(/data-testid="stack-limit-max-width"[\s\S]*?50%/);
    expect(body).toMatch(/data-testid="stack-limit-min-height"[\s\S]*?20px/);
    expect(body).toContain('data-testid="stack-limit-clear-max-width"');
  });

  it('shows no limit chips while none is set', () => {
    expect(section(row, 'a')).not.toContain('data-testid="stack-limits"');
  });
});
