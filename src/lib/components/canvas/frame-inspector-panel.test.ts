import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import FrameInspectorPanel from './FrameInspectorPanel.svelte';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { EditorMode, editorMode } from '$lib/canvas/editor-mode.svelte';
import { frameProperties, type NodePlace } from './frame-properties.svelte';
import { stackFrame } from '$lib/motion/layout/ops';

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
    { viewPath: () => [], show: () => {}, recorded: () => {}, stepped: () => {}, playhead: () => 0, saved: () => {}, landed: () => {}, pull: async () => {}, send: async () => ({ ok: false, error: 'off' }) }
  );
}

const valueOf = (body: string, attr: string) => new RegExp(`<input[^>]*${attr}[^>]*>`).exec(body)?.[0].match(/value="([^"]*)"/)?.[1] ?? null;

const element = (() => {
  const doc = { ...newMotionDoc(MotionFormat.Landscape), still: { frame: 0 }, width: 400, height: 240 } as MotionDoc;
  return must(addClip(doc, { component: 'Shape', from: 0, props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, roundness: 0.25 } }, 'a'));
})();

function elementSession() {
  return new FrameEditSession(
    { head: { version: 1, doc: element }, selection: ['a'] },
    { viewPath: () => [], show: () => {}, recorded: () => {}, stepped: () => {}, playhead: () => 0, saved: () => {}, landed: () => {}, pull: async () => {}, send: async () => ({ ok: false, error: 'off' }) }
  );
}

const placeOf = (box: { x: number; y: number; w: number; h: number }): NodePlace => ({ ...box, rotation: 0, set: () => undefined, resize: () => undefined, turn: () => undefined, flip: () => undefined, align: null });

const hosted = (box = { x: 30, y: 40, w: 200, h: 120, rotation: 90 }) => {
  frameProperties.place = placeOf(box);
  frameProperties.host = { clipId: 'a', box, move: () => undefined, resize: () => undefined, turn: () => undefined };
  const body = render(FrameInspectorPanel, { props: { session: elementSession(), tokens: FEEGA_TOKENS } }).body;
  frameProperties.clear();
  return body;
};

describe('a layer aligned in its frame', () => {
  it('reads X where align put it, offset included', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2 }, transform: { x: 0.1 } }, 'a'));
    const session = new FrameEditSession(
      { head: { version: 1, doc }, selection: ['a'] },
      { viewPath: () => [], show: () => {}, recorded: () => {}, stepped: () => {}, playhead: () => 0, saved: () => {}, landed: () => {}, pull: async () => {}, send: async () => ({ ok: false, error: 'off' }) }
    );
    const body = render(FrameInspectorPanel, { props: { session, tokens: FEEGA_TOKENS } }).body;

    expect(valueOf(body, 'data-testid="position-x"')).toBe(String(Math.round(0.4 * doc.width + 0.1 * doc.width)));
  });
});

describe('a free element reads as one object on the canvas', () => {
  it('its rotation is the node rotation, not the upright root inside its doc', () => {
    expect(valueOf(hosted(), 'data-testid="rotation-field"')).toBe('90');
  });

  it('its X and Y are where the node sits on the canvas', () => {
    const body = hosted();

    expect(valueOf(body, 'data-testid="position-x"')).toBe('30');
    expect(valueOf(body, 'data-testid="position-y"')).toBe('40');
  });

  it('its X and Y keep their decimals, two at most, like Figma', () => {
    const body = hosted({ x: 30.5, y: 40.257, w: 200, h: 120, rotation: 0 });

    expect(valueOf(body, 'data-testid="position-x"')).toBe('30.5');
    expect(valueOf(body, 'data-testid="position-y"')).toBe('40.26');
  });

  it('its W and H are canvas px, though its doc holds two px for each', () => {
    const body = hosted();

    expect(valueOf(body, 'aria-label="Width"')).toBe('200');
    expect(valueOf(body, 'aria-label="Height"')).toBe('120');
  });

  it('its radius is canvas px too', () => {
    expect(valueOf(hosted(), 'aria-label="Roundness"')).toBe('30');
  });

  it('it has no frame to pin to, so no constraints', () => {
    expect(hosted()).not.toContain('data-testid="constraints-section"');
  });
});

const doubled = (() => {
  const doc = { ...newMotionDoc(MotionFormat.Landscape), still: { frame: 0 }, width: 1400, height: 920, freeSize: true } as MotionDoc;
  return must(addClip(doc, { component: 'Shape', from: 0, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2, roundness: 0.25 } }, 'a'));
})();

const doubledPanel = (selection: string[]) => {
  frameProperties.place = placeOf({ x: 0, y: 0, w: 700, h: 460 });
  const session = new FrameEditSession(
    { head: { version: 1, doc: doubled }, selection },
    { viewPath: () => [], show: () => {}, recorded: () => {}, stepped: () => {}, playhead: () => 0, saved: () => {}, landed: () => {}, pull: async () => {}, send: async () => ({ ok: false, error: 'off' }) }
  );
  const body = render(FrameInspectorPanel, { props: { session, tokens: FEEGA_TOKENS } }).body;
  frameProperties.clear();
  return body;
};

describe('a frame held at two doc px per canvas px reads as it is on the canvas', () => {
  it('its size is the size of the frame on the canvas', () => {
    const body = doubledPanel([]);

    expect(valueOf(body, 'data-testid="frame-width"')).toBe('700');
    expect(valueOf(body, 'data-testid="frame-height"')).toBe('460');
  });

  it('a child reads W, H and radius in canvas px', () => {
    const body = doubledPanel(['a']);

    expect(valueOf(body, 'aria-label="Width"')).toBe('140');
    expect(valueOf(body, 'aria-label="Height"')).toBe('92');
    expect(valueOf(body, 'aria-label="Roundness"')).toBe('23');
  });
});

const html = (selection: string[], part: string | null = null) => render(FrameInspectorPanel, { props: { session: sessionOf(selection), tokens: FEEGA_TOKENS, part } }).body;

describe('the frame itself', () => {
  const placed = (patch: Partial<NodePlace> = {}): NodePlace => ({ ...placeOf({ x: 120, y: 40, w: 100, h: 100 }), ...patch });

  it('places the frame with X and Y and heads the panel with its name', () => {
    frameProperties.place = placed();
    frameProperties.name = 'Hero';
    const body = html([]);
    frameProperties.clear();

    expect(body).toMatch(/aria-label="Frame X"[^>]*value="120"|value="120"[^>]*aria-label="Frame X"/);
    expect(body).toContain('aria-label="Frame Y"');
    expect(body).toMatch(/data-testid="layer-name"[^>]*value="Hero"|value="Hero"[^>]*data-testid="layer-name"/);
  });

  it('turns and flips like any layer', () => {
    frameProperties.place = placed({ rotation: 30 });
    const body = html([]);
    frameProperties.clear();

    expect(body).toMatch(/aria-label="Frame rotation"[^>]*value="30"|value="30"[^>]*aria-label="Frame rotation"/);
    expect(body).toContain('data-testid="frame-flip-horizontal"');
    expect(body).toContain('data-testid="frame-flip-vertical"');
  });

  it('aligns inside what holds it, and offers nothing to align to when nothing does', () => {
    frameProperties.place = placed({ align: () => undefined });
    const held = html([]);
    frameProperties.place = placed();
    const loose = html([]);
    frameProperties.clear();

    expect(held).toContain('data-testid="frame-align"');
    expect(held).not.toMatch(/data-testid="frame-align"[^>]*disabled/);
    expect(loose).toMatch(/<fieldset[^>]*disabled[^>]*data-testid="frame-align"|data-testid="frame-align"[^>]*disabled/);
  });

  it('adds auto layout to the frame itself', () => {
    frameProperties.place = placed();
    const body = html([]);
    frameProperties.clear();

    expect(body).toContain('data-testid="frame-add-auto-layout"');
  });

  it('once stacked, the frame shows its stack settings instead of the entry', () => {
    const doc = must(stackFrame(sessionOf([]).history.present, 'frame-surface'));
    const session = new FrameEditSession(
      { head: { version: 1, doc }, selection: [] },
      { viewPath: () => [], show: () => {}, recorded: () => {}, stepped: () => {}, playhead: () => 0, saved: () => {}, landed: () => {}, pull: async () => {}, send: async () => ({ ok: false, error: 'off' }) }
    );
    const body = render(FrameInspectorPanel, { props: { session, tokens: FEEGA_TOKENS } }).body;

    expect(body).toContain('data-testid="stack-section"');
    expect(body).not.toContain('data-testid="frame-add-auto-layout"');
  });
});

describe('frame inspector panel', () => {
  it('keeps frame actions in the context menu, out of the right bar', () => {
    frameProperties.runAction = () => undefined;
    const body = html([]);
    frameProperties.clear();

    expect(body).not.toContain('data-testid="frame-actions"');
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
    frameProperties.place = placeOf({ x: 0, y: 0, w: 540, h: 540 });
    const body = html([]);
    frameProperties.clear();

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

describe('export, where Figma puts it', () => {
  it('the frame panel ends with an Export section: a 1x PNG row, a + for more and an Export button', () => {
    frameProperties.exportRows = async () => 'off';
    const body = html([]);
    frameProperties.clear();

    expect(body).toContain('data-testid="export-section"');
    expect(body).toContain('data-testid="export-add"');
    expect(body).toMatch(/aria-label="Export scale"/);
    expect(body).toMatch(/aria-label="Export format"/);
    expect(body).toMatch(/data-testid="export-go"[^>]*>[^<]*Export Frame/);
  });

  it('a selected layer exports from the same section', () => {
    frameProperties.exportRows = async () => 'off';
    const body = html(['a']);
    frameProperties.clear();

    expect(body).toContain('data-testid="export-go"');
  });
});
