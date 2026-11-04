import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { laidClip, wrapInStack } from '$lib/motion/layout/ops';
import { estimatedText, type TextMeasure } from '@feega/motion-core/motion/layout/text-extent';
import MotionInspector from './MotionInspector.svelte';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const texted = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'Hello', x: 0.5, y: 0.5, width: 0.4, height: 0.1 } }, 't'));
const stacked = must(wrapInStack(texted, ['t'], 'stack', 'lane'));

const inspect = (doc: MotionDoc, id: string) => render(MotionInspector, { props: { doc, clip: findClip(doc, id)!.clip, tokens: FEEGA_TOKENS, assets: [], frame: 0, onchange: () => {} } }).body;

describe('a Stack wrapping one text shows its own visual properties', () => {
  const html = inspect(stacked, 'stack');

  it.each(['stack', 'fill', 'stroke', 'layer', 'effects'])('has the %s section', (section) => {
    expect(html).toContain(`data-section="${section}"`);
  });

  it('shows padding, radius and clip content', () => {
    expect(html).toContain('data-testid="auto-layout-padding-x"');
    expect(html).toContain('data-testid="radius-per-corner"');
    expect(html).toContain('data-testid="stack-clip-content"');
  });

  it('is not the text inspector', () => {
    expect(html).not.toContain('data-section="text"');
  });
});

describe('a hug Stack shows the size the canvas draws, not the estimate', () => {
  const wider: TextMeasure = (component, props, unit, width) => {
    const size = estimatedText(component, props, unit, width);
    return { width: size.width * 2, height: size.height };
  };

  const hugging = must(wrapInStack(must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'Hello', sizing: 'auto', x: 0.5, y: 0.5, width: 0.4, height: 0.1 } }, 't')), ['t'], 'stack', 'lane'));

  it('W follows the measure the canvas lays text out with', () => {
    const px = Math.round(Number(laidClip(hugging, 'stack', wider)!.props.width) * hugging.width);
    const html = render(MotionInspector, { props: { doc: hugging, clip: findClip(hugging, 'stack')!.clip, tokens: FEEGA_TOKENS, assets: [], frame: 0, measure: wider, onchange: () => {} } }).body;

    expect(px).not.toBe(Math.round(Number(laidClip(hugging, 'stack')!.props.width) * hugging.width));
    expect(html).toContain(`value="${px}"`);
  });
});
