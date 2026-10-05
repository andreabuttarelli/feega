import { describe, expect, it } from 'vitest';
import { CAMERA_PRESETS } from '$lib/canvas/composition/camera';
import { LAYOUTS } from '$lib/canvas/composition/index';
import type { CompositionNode } from '$lib/canvas/composition-node';
import { FPS } from './design';
import { FORMATS, MotionFormat, findClip, newMotionDoc, parseMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import {
  COMPOSITION_CLIP,
  HEADLINE_CLIP,
  LOGO_CLIP,
  applyDraft,
  composeEditorPath,
  draftFromDoc,
  draftFromNode,
  newDraft,
  nodeDoc,
  withLayout,
  type ComposeDraft
} from './composition-draft';

function docOf(draft: ComposeDraft, base: MotionDoc = newMotionDoc(draft.format)): MotionDoc {
  const verdict = applyDraft(base, draft);
  if (!verdict.ok) {
    throw new Error(verdict.error);
  }
  return verdict.doc;
}

const MEDIA = [
  { assetId: 'a', kind: 'image' as const },
  { assetId: 'v', kind: 'video' as const }
];

describe('compose draft ⇄ motion doc', () => {
  it('a new draft becomes a valid doc with one composition clip filling the video', () => {
    const doc = docOf({ ...newDraft('helix'), media: MEDIA, seconds: 8 });
    const found = findClip(doc, COMPOSITION_CLIP);

    expect(parseMotionDoc(doc).ok).toBe(true);
    expect(doc.durationInFrames).toBe(8 * FPS);
    expect(found?.clip).toMatchObject({ component: 'Composition', from: 0, durationInFrames: 8 * FPS });
    expect(found?.clip.props).toMatchObject({ layout: 'helix', media: MEDIA, loop: 8 });
  });

  it('reads back the same draft it wrote', () => {
    const draft: ComposeDraft = { ...newDraft('coverflow'), media: MEDIA, headline: 'Spring drop', logo: true, format: MotionFormat.Square, background: '#112233' };

    expect(draftFromDoc(docOf(draft))).toEqual(draft);
  });

  it('switches the frame size with the format', () => {
    const doc = docOf({ ...newDraft('helix'), format: MotionFormat.Portrait });

    expect({ width: doc.width, height: doc.height }).toEqual({ width: FORMATS[MotionFormat.Portrait].width, height: FORMATS[MotionFormat.Portrait].height });
  });

  it('removes the headline and logo when the draft drops them', () => {
    const withText = docOf({ ...newDraft('helix'), headline: 'Hi', logo: true });
    const without = docOf({ ...newDraft('helix'), headline: '', logo: false }, withText);

    expect(findClip(without, HEADLINE_CLIP)).toBeNull();
    expect(findClip(without, LOGO_CLIP)).toBeNull();
  });

  it('keeps clips added in the motion editor', () => {
    const first = docOf(newDraft('helix'));
    const added = addClip(first, { component: 'Kicker', from: 0, durationInFrames: 30 }, 'extra');
    if (!added.ok) {
      throw new Error(added.error);
    }

    expect(findClip(docOf({ ...newDraft('media-ring'), seconds: 4 }, added.doc), 'extra')).not.toBeNull();
  });

  it('has no draft when the motion editor removed the composition', () => {
    expect(draftFromDoc(newMotionDoc(MotionFormat.Vertical))).toBeNull();
  });
});

describe('withLayout', () => {
  it('resets the template settings to the new layout defaults', () => {
    const next = withLayout({ ...newDraft('helix'), layoutParams: { radius: 9 } }, 'coverflow');

    expect(next.layoutParams).toEqual(Object.fromEntries(LAYOUTS.coverflow.params.map((p) => [p.name, p.default])));
  });

  it('a fixed-camera layout gets the still camera, as the canvas editor did', () => {
    const next = withLayout(newDraft('helix'), 'vertical-flow');

    expect(next.camera).toBe('static');
    expect(next.cameraParams).toEqual(Object.fromEntries(CAMERA_PRESETS.static.params.map((p) => [p.name, p.default])));
  });
});

describe('draftFromNode: an old canvas composition node opens as the same video', () => {
  const node: CompositionNode = {
    id: 'n1',
    layout: 'media-ring',
    layoutParams: { rings: 2 },
    camera: { preset: 'dolly', params: { travel: 4 } },
    background: { color: '#ff0000' },
    duration: 7.5,
    aspect: '16:9',
    refId: null
  };

  it('carries layout, camera, background, duration, format and media over', () => {
    expect(draftFromNode(node, MEDIA)).toEqual({
      ...newDraft('media-ring'),
      layoutParams: { rings: 2 },
      camera: 'dolly',
      cameraParams: { travel: 4 },
      background: '#ff0000',
      seconds: 7.5,
      format: MotionFormat.Landscape,
      media: MEDIA
    });
  });

  it('clamps a duration the motion engine cannot hold', () => {
    expect(draftFromNode({ ...node, duration: 600 }, MEDIA).seconds).toBe(60);
    expect(draftFromNode({ ...node, duration: 0.1 }, MEDIA).seconds).toBe(0.5);
  });

  it('produces a doc the server accepts', () => {
    expect(parseMotionDoc(docOf(draftFromNode(node, MEDIA))).ok).toBe(true);
  });
});

it('composeEditorPath points at the compositions tool for that video', () => {
  expect(composeEditorPath({ projectId: 'p', nodeId: 'n' })).toBe('/app/compose/n?project=p');
});

describe('a canvas composition node, read as a motion video', () => {
  const node: CompositionNode = { id: 'n1', layout: 'ring', layoutParams: { count: 6, tiltX: -20 }, camera: { preset: 'static', params: {} }, background: { color: '#112233' }, duration: 8, aspect: '16:9', refId: null };

  it('keeps its layout, settings, length, format and media, so a stored node plays in the motion engine without losing anything', () => {
    const doc = nodeDoc(node, [{ assetId: 'a1', kind: 'image' }]);
    const clip = findClip(doc, COMPOSITION_CLIP)!.clip;

    expect(parseMotionDoc(doc).ok).toBe(true);
    expect([doc.width, doc.height]).toEqual([FORMATS[MotionFormat.Landscape].width, FORMATS[MotionFormat.Landscape].height]);
    expect(doc.durationInFrames).toBe(8 * FPS);
    expect(clip.props).toMatchObject({ layout: 'ring', layoutParams: { count: 6, tiltX: -20 }, camera: 'static', background: '#112233', media: [{ assetId: 'a1', kind: 'image' }] });
  });
});
