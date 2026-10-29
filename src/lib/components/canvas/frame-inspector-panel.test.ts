import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import FrameInspectorPanel from './FrameInspectorPanel.svelte';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { EditorMode, editorMode } from '$lib/canvas/editor-mode.svelte';
import { frameProperties } from './frame-properties.svelte';

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
    { viewPath: () => [], show: () => {}, recorded: () => {}, stepped: () => {}, playhead: () => 0, saved: () => {}, pull: async () => {}, send: async () => ({ ok: false, error: 'off' }) }
  );
}

const html = (selection: string[], part: string | null = null) => render(FrameInspectorPanel, { props: { session: sessionOf(selection), tokens: FEEGA_TOKENS, part } }).body;

describe('frame inspector panel', () => {
  it('lists the frame "…" entries in the right bar', () => {
    frameProperties.runAction = () => undefined;
    const body = html([]);
    frameProperties.clear();

    expect(body).toContain('data-testid="frame-action-frame-history"');
    expect(body).toContain('data-testid="frame-action-export"');
  });

  it('offers voice-over and music in Motion only', () => {
    frameProperties.runAction = () => undefined;
    editorMode.set(EditorMode.Motion);
    const motion = html([]);
    editorMode.set(EditorMode.Design);
    const design = html([]);
    frameProperties.clear();

    expect(motion).toContain('data-testid="frame-sound-voice"');
    expect(motion).toContain('data-testid="frame-sound-music"');
    expect(design).not.toContain('data-testid="frame-sound-section"');
  });

  it('shows the frame itself, with its camera, when no element is selected', () => {
    const body = html([]);

    expect(body).toContain('data-testid="frame-inspector"');
    expect(body).toContain('data-testid="camera-inspector"');
    expect(body).not.toContain('data-testid="clip-bar"');
  });

  it('shows the frame look like a layer: fill, stroke, corners, effects, with the frame settings folded below', () => {
    const body = html([]);

    expect(body).toContain('data-testid="frame-look"');
    for (const section of ['layer', 'fill', 'stroke', 'effects']) {
      expect(body).toContain(`data-section="${section}"`);
    }
    expect(body).not.toContain('data-section="timing"');
    expect(body).not.toContain('data-section="shape"');
    expect(body).toContain('data-testid="radius-per-corner"');
    expect(body).toContain('data-testid="frame-width"');
    expect(body).toContain('data-prop="clipContent"');
    expect(body).toContain('data-testid="frame-height"');
    expect(body.indexOf('data-testid="frame-look"')).toBeLessThan(body.indexOf('data-testid="frame-settings"'));
    expect(body.indexOf('data-testid="frame-settings"')).toBeLessThan(body.indexOf('data-testid="camera-inspector"'));
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

  it('offers the layout guides of the frame when no element is selected', () => {
    expect(html([])).toContain('data-testid="layout-guides-section"');
    expect(html(['a'])).not.toContain('data-testid="layout-guides-section"');
  });

  it('says so when there is no frame session', () => {
    expect(render(FrameInspectorPanel, { props: { session: null, tokens: FEEGA_TOKENS } }).body).toContain('data-testid="properties-empty"');
  });

  it('shows the motion inspector with its actions in the header, not a clip bar strip, for one element', () => {
    const body = html(['a']);

    expect(body).toContain('data-testid="frame-inspector"');
    expect(body).toContain('data-testid="header-actions"');
    expect(body).not.toContain('data-testid="clip-bar"');
  });

  it('shows the inspector for several elements', () => {
    expect(html(['a', 'b'])).toContain('data-testid="frame-inspector"');
  });

  it('no longer carries a per-frame mode row: the mode lives in the header', () => {
    for (const selection of [[], ['a']]) {
      const body = html(selection);

      expect(body).not.toContain('data-testid="frame-mode-row"');
      expect(body).not.toContain('>Coder mode<');
    }
  });

  it('reads the layer code in Code mode and the prototype in Play', () => {
    editorMode.set(EditorMode.Code);
    expect(html(['a'])).toContain('aria-label="Code mode"');

    editorMode.set(EditorMode.Play);
    const element = html(['a']);
    expect(element).toContain('data-testid="play-inspector"');
    expect(element).toContain('data-testid="prototype-section"');
    expect(element).toContain('data-testid="flow-section"');
    expect(element).toContain('data-testid="interactive-panel"');
    expect(element).toContain('data-testid="play-frame-live"');
    expect(element).toContain('data-testid="prototype-copy-link"');
    expect(html([])).not.toContain('data-testid="prototype-section"');

    editorMode.set(EditorMode.Design);
    expect(html(['a'])).toContain('data-testid="header-actions"');
  });
});
