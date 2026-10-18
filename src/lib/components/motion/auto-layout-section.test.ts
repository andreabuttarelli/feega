import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { Justify } from '$lib/motion/layout/auto-layout';
import { setAutoLayout, wrapInAutoLayout } from '$lib/motion/layout/ops';
import { addClip, type OpResult } from '$lib/motion/timeline';
import AutoLayoutSection from './AutoLayoutSection.svelte';


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
  return must(wrapInAutoLayout(doc, ['a', 'b'], 'box', 'lane'));
})();

const clip = (doc: MotionDoc, id: string) => findClip(doc, id)!.clip;
const html = (doc: MotionDoc, id: string) => render(AutoLayoutSection, { props: { doc, clip: clip(doc, id), commit: () => {} } }).body;

describe('the auto layout section', () => {
  it('a container shows direction, alignment, gap and padding, and can be removed', () => {
    const body = html(row, 'box');
    for (const id of ['auto-layout-align', 'auto-layout-gap', 'auto-layout-padding', 'auto-layout-remove']) {
      expect(body).toContain(`data-testid="${id}"`);
    }
    expect(body).toMatch(/aria-label="Horizontal"[^>]*aria-checked="true"|aria-checked="true"[^>]*aria-label="Horizontal"/);
    expect(body).not.toContain('auto-layout-leave');
  });

  it('marks the alignment spot and space between that the layout uses', () => {
    expect(html(row, 'box')).toMatch(/aria-label="Align start start"[^>]*aria-pressed="true"/);
    expect(html(must(setAutoLayout(row, 'box', { justify: Justify.SpaceBetween })), 'box')).toMatch(/aria-pressed="true"[^>]*data-testid="auto-layout-space-between"|data-testid="auto-layout-space-between"[^>]*aria-pressed="true"/);
  });

  it('a child offers fill, absolute, reorder and leaving', () => {
    const body = html(row, 'a');
    expect(body).toContain('>Fill<');
    for (const id of ['auto-layout-absolute', 'auto-layout-leave']) {
      expect(body).toContain(`data-testid="${id}"`);
    }
    expect(body).not.toContain('auto-layout-gap');
  });

  it('sizes read Fixed, Fit and Fill, as in Framer', () => {
    const body = html(row, 'a');
    expect(body).toContain('>Fit<');
    expect(body).not.toContain('>Hug<');
  });

  it('padding is one value until it differs per side', () => {
    const even = html(row, 'box');
    expect(even).toContain('data-testid="auto-layout-padding-sides"');
    expect(even).not.toContain('data-testid="auto-layout-padding-top"');
    const uneven = html(must(setAutoLayout(row, 'box', { padding: { top: 8, right: 0, bottom: 0, left: 0 } })), 'box');
    expect(uneven).toContain('data-testid="auto-layout-padding-top"');
    expect(uneven).not.toContain('data-testid="auto-layout-padding"');
  });

  it('absolute is a Yes / No', () => {
    expect(html(row, 'a')).toMatch(/data-segmented="Absolute"[\s\S]*?>Yes<[\s\S]*?>No</);
  });

  it('a plain rectangle only offers to add auto layout', () => {
    const body = html(row, 'plain');
    expect(body).toContain('data-testid="auto-layout-add"');
    expect(body).not.toContain('Width sizing');
  });
});
