import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { setAutoLayout, wrapInStack } from '$lib/motion/layout/ops';
import { EditMode } from '$lib/motion/edit-mode';
import MotionInspector from './MotionInspector.svelte';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const texted = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'Hello', x: 0.5, y: 0.5, width: 0.4, height: 0.1, color: '#ff3366' } }, 't'));
const stacked = must(wrapInStack(texted, ['t'], 'stack', 'lane'));

const inspect = (doc: MotionDoc, id: string) => render(MotionInspector, { props: { doc, clip: findClip(doc, id)!.clip, tokens: FEEGA_TOKENS, assets: [], frame: 0, mode: EditMode.Design, onchange: () => {} } }).body;

const sectionOf = (html: string, name: string) => {
  const start = html.indexOf(`data-section="${name}"`);
  const next = html.indexOf('data-section="', start + 1);
  return start < 0 ? '' : html.slice(start, next < 0 ? undefined : next);
};

const order = (html: string) => [...html.matchAll(/data-section="([^"]+)"/g)].map((m) => m[1]);

describe('the Stack inspector follows the auto layout panel', () => {
  const html = inspect(stacked, 'stack');
  const stack = sectionOf(html, 'stack');
  const layer = sectionOf(html, 'layer');

  it('orders alignment, position, stack, appearance, paints, effects, then selection colours', () => {
    const shown = order(html);
    const wanted = ['align', 'layout', 'stack', 'layer', 'fill', 'stroke', 'effects', 'colours'];
    expect(shown.filter((s) => wanted.includes(s))).toEqual(wanted);
  });

  it('keeps W and H out of the position section and inside the stack, with their mode inline', () => {
    expect(sectionOf(html, 'layout')).not.toContain('data-prop="width"');
    expect(stack).toContain('data-testid="stack-size-width"');
    expect(stack).toContain('data-testid="stack-unit-height"');
  });

  it('unwraps from the direction row', () => {
    expect(stack).toContain('data-testid="auto-layout-direction"');
    expect(stack).toContain('data-testid="auto-layout-remove"');
  });

  it('pairs the alignment grid with a gap that can be Auto', () => {
    expect(stack).toContain('data-testid="auto-layout-align"');
    expect(stack).toContain('data-testid="auto-layout-gap"');
    expect(stack).toContain('data-testid="auto-layout-gap-mode"');
  });

  it('pads horizontally and vertically, with a per-side toggle', () => {
    expect(stack).toContain('data-testid="auto-layout-padding-x"');
    expect(stack).toContain('data-testid="auto-layout-padding-y"');
    expect(stack).toContain('data-testid="auto-layout-padding-sides"');
  });

  it('clips content from a checkbox in the stack, not in appearance', () => {
    expect(stack).toMatch(/type="checkbox"[^>]*data-testid="stack-clip-content"|data-testid="stack-clip-content"[^>]*type="checkbox"/);
    expect(layer).not.toContain('data-prop="clipContent"');
  });

  it('shows opacity with an eye, then radius, then blend', () => {
    const at = (needle: string) => layer.indexOf(needle);
    expect(at('data-testid="layer-visibility"')).toBeGreaterThan(-1);
    expect(at('data-testid="opacity-field"')).toBeLessThan(at('data-testid="radius"'));
    expect(at('data-testid="radius"')).toBeLessThan(at('data-testid="blend-select"'));
  });

  it('lists the colours used inside the stack', () => {
    expect(sectionOf(html, 'colours')).toContain('#ff3366');
  });
});

describe('Auto gap spaces the children apart', () => {
  it('shows Auto when the stack spreads its children', () => {
    const spread = must(setAutoLayout(stacked, 'stack', { justify: 'space-between' as never }));
    expect(sectionOf(inspect(spread, 'stack'), 'stack')).toMatch(/<option[^>]*value="auto"[^>]*selected/);
  });
});
