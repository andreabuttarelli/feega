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
  const two = must(addClip(one, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'Two' } }, 'b'));
  const device = must(addClip(two, { component: 'Device3D', from: 0, durationInFrames: 30, props: {} }, 'device'));
  const doc = must(addClip(device, { component: 'Particles', from: 0, durationInFrames: 30, props: {} }, 'sparks'));
  return new FrameEditSession(
    { head: { version: 1, doc }, selection },
    { viewPath: () => [], show: () => {}, recorded: () => {}, saved: () => {}, pull: async () => {}, send: async () => ({ ok: false, error: 'off' }) }
  );
}

const html = (selection: string[], part: string | null = null) => render(FrameInspectorPanel, { props: { session: sessionOf(selection), tokens: FEEGA_TOKENS, part } }).body;

describe('frame inspector panel', () => {
  it('shows the frame itself, with its camera, when no element is selected', () => {
    const body = html([]);

    expect(body).toContain('data-testid="frame-inspector"');
    expect(body).toContain('data-testid="camera-inspector"');
    expect(body).not.toContain('data-testid="clip-bar"');
  });

  it('offers device presets on a device', () => {
    expect(html(['device'])).toContain('data-testid="device-presets"');
  });

  it('offers particle presets on particles', () => {
    expect(html(['sparks'])).toContain('data-testid="particle-presets"');
    expect(html(['a'])).not.toContain('data-testid="particle-presets"');
  });

  it('styles the picked part of the element', () => {
    expect(html(['a'], 'text:0')).toContain('data-testid="poster-part"');
    expect(html(['a'])).not.toContain('data-testid="poster-part"');
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
