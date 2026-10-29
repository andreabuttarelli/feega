import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import FrameInspectorPanel from './FrameInspectorPanel.svelte';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { addBreakpoint, BreakpointPreset, OverrideKey, setOverride } from '@feega/motion-core/motion/breakpoints/model';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function sessionAt(breakpoint: string, selection: string[]) {
  const titled = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'Hello' } }, 'a'));
  const phone = must(addBreakpoint(titled, BreakpointPreset.Phone, 'ph'));
  const doc = must(setOverride(phone, 'ph', 'a', OverrideKey.Hidden, true));
  const session = new FrameEditSession(
    { head: { version: 1, doc }, selection },
    { viewPath: () => [], show: () => {}, recorded: () => {}, stepped: () => {}, playhead: () => 0, saved: () => {}, landed: () => {}, pull: async () => {}, send: async () => ({ ok: false, error: 'off' }) }
  );
  session.breakpoint = breakpoint;
  return session;
}

const html = (breakpoint: string, selection: string[]) => render(FrameInspectorPanel, { props: { session: sessionAt(breakpoint, selection), tokens: FEEGA_TOKENS } }).body;

describe('frame inspector with breakpoints', () => {
  it('lists the frame views with an add breakpoint button', () => {
    const body = html('base', []);

    expect(body).toContain('data-testid="add-breakpoint"');
    expect(body).toContain('Phone');
  });

  it('marks a prop overridden in the active view, with a reset', () => {
    const body = html('ph', ['a']);

    expect(body).toContain('Visibility overridden in Phone');
    expect(body).toContain('Reset');
  });

  it('shows no override note on the base view', () => {
    expect(html('base', ['a'])).not.toContain('overridden in');
  });
});
