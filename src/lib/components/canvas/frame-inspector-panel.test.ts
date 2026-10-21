import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import FrameInspectorPanel from './FrameInspectorPanel.svelte';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip, type OpResult } from '$lib/motion/timeline';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function sessionOf(selection: string[]) {
  const one = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'One' } }, 'a'));
  const doc = must(addClip(one, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'Two' } }, 'b'));
  return new FrameEditSession(
    { head: { version: 1, doc }, selection },
    { viewPath: () => [], show: () => {}, recorded: () => {}, saved: () => {}, pull: async () => {}, send: async () => ({ ok: false, error: 'off' }) }
  );
}

const html = (selection: string[]) => render(FrameInspectorPanel, { props: { session: sessionOf(selection), tokens: FEEGA_TOKENS } }).body;

describe('frame inspector panel', () => {
  it('says so when no element is selected', () => {
    const body = html([]);

    expect(body).not.toContain('data-testid="frame-inspector"');
    expect(body).toContain('data-testid="properties-empty"');
  });

  it('says so when there is no frame session', () => {
    expect(render(FrameInspectorPanel, { props: { session: null, tokens: FEEGA_TOKENS } }).body).toContain('data-testid="properties-empty"');
  });

  it('shows the motion inspector and the clip bar for one element', () => {
    const body = html(['a']);

    expect(body).toContain('data-testid="frame-inspector"');
    expect(body).toContain('data-testid="clip-bar"');
  });

  it('shows the inspector for several elements', () => {
    expect(html(['a', 'b'])).toContain('data-testid="frame-inspector"');
  });
});
