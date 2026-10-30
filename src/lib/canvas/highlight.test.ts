import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { groupClips } from '$lib/motion/group';
import { wrapInStack } from '$lib/motion/layout/ops';
import { createComponent } from '$lib/motion/main-component';
import { placeInstance } from '$lib/motion/canvas-components';
import { HIGHLIGHT, COMPONENT_PURPLE, HighlightKind, SELECT_BLUE, highlightOf } from './highlight';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const withClip = (doc: MotionDoc, id: string, component: MotionClip['component'], props: Record<string, unknown>) => must(addClip(doc, { component, from: 0, durationInFrames: 30, props }, id));

const base = newMotionDoc(MotionFormat.Square);
const text = withClip(base, 't', 'Text', { text: 'Hello' });
const shape = withClip(text, 's', 'Shape', {});
const stacked = must(wrapInStack(text, ['t'], 'stack', 'lane'));
const grouped = must(groupClips(shape, ['t', 's'], () => 'g'));
const made = must(createComponent(text, ['t'], () => 'x', 'Button'));
const mainId = made.tracks.flatMap((t) => t.clips)[0].id;
const copy = must(placeInstance(newMotionDoc(MotionFormat.Square), made, String(made.tracks[0].clips[0].props.comp), () => 'copy'));

describe('what a highlight is painted in', () => {
  it.each([
    ['a text', text, 't'],
    ['a shape', shape, 's'],
    ['a stack', stacked, 'stack'],
    ['a group', grouped, 'g']
  ])('%s is blue', (_, doc, id) => {
    expect(highlightOf(doc, id)).toBe(HighlightKind.Element);
    expect(HIGHLIGHT[highlightOf(doc, id)]).toBe(SELECT_BLUE);
  });

  it('a canvas node is blue', () => {
    expect(HIGHLIGHT[HighlightKind.Node]).toBe(SELECT_BLUE);
  });

  it('a main component is purple', () => {
    expect(HIGHLIGHT[highlightOf(made, mainId)]).toBe(COMPONENT_PURPLE);
  });

  it('an instance of a component is purple', () => {
    expect(HIGHLIGHT[highlightOf(copy, 'copy')]).toBe(COMPONENT_PURPLE);
  });

  it('the stylesheet tokens match the table', () => {
    const css = readFileSync('src/app.css', 'utf8');

    expect(css).toContain(`--ui-highlight: ${SELECT_BLUE};`);
    expect(css).toContain(`--ui-highlight-component: ${COMPONENT_PURPLE};`);
  });
});
