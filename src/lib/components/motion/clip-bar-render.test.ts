import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ClipBar from './ClipBar.svelte';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip, type OpResult } from '$lib/motion/timeline';
import { precompose } from '$lib/motion/precomp';
import { PickMode } from '$lib/motion/clip-bar';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function fixture(): MotionDoc {
  let d = newMotionDoc(MotionFormat.Square);
  d = must(addClip(d, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'One' } }, 'a'));
  d = must(addClip(d, { component: 'Title', from: 10, durationInFrames: 20, props: { text: 'Two' } }, 'b'));
  return must(precompose(d, ['a'], { comp: 'c1', clip: 'p' }, 'Comp 1'));
}

const html = (selection: string[], pick = PickMode.One) => render(ClipBar, { props: { doc: fixture(), selection, pick, onrun: () => {}, ondone: () => {} } }).body;

describe('clip bar', () => {
  it('names every action of the selected precomp, Open included', () => {
    const body = html(['p']);

    for (const name of ['Split clip', 'Duplicate', 'Delete', 'Open composition', 'Parent to…', 'Select several', 'Properties']) {
      expect(body, name).toContain(`aria-label="${name}"`);
    }
  });

  it('in multi-select shows the count and a Done', () => {
    const body = html(['p', 'b'], PickMode.Many);

    expect(body).toContain('2 selected');
    expect(body).toContain('>Done</button>');
  });

  it('draws nothing without a selection', () => {
    expect(html([])).not.toContain('data-testid="clip-bar"');
  });
});
