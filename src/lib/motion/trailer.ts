import { TrackKind } from './components';
import { FPS, TransitionKind } from './design';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip, addTrack, setCanvas, type NewClip, type OpResult } from './timeline';

export type TrailerAssets = { modelId: string | null; imageId: string | null };

const s = (seconds: number) => Math.round(seconds * FPS);
const IN = { kind: TransitionKind.SlideUp, durationInFrames: 10 };
const OUT = { kind: TransitionKind.Fade, durationInFrames: 8 };

type Beat = NewClip & { id: string };

function beats(assets: TrailerAssets): Beat[] {
  const kicker = (id: string, text: string, from: number, len: number, x = 0.27): Beat => ({
    id,
    component: 'Kicker',
    trackId: 'text',
    from: s(from),
    durationInFrames: s(len),
    props: { text, x, y: 0.3, width: 0.42, align: 'left' },
    transitionIn: IN,
    transitionOut: OUT
  });
  const title = (id: string, text: string, from: number, len: number, x = 0.27, size = 0.12): Beat => ({
    id,
    component: 'Title',
    trackId: 'text',
    from: s(from),
    durationInFrames: s(len),
    props: { text, x, y: 0.52, width: 0.42, height: 0.36, align: 'left', size },
    transitionOut: OUT
  });

  return [
    { id: 'bg', component: 'BrandBackground', trackId: 'bg', from: 0, durationInFrames: s(18), props: { pattern: 'dots' } },
    { ...kicker('k1', '( feega )', 0.2, 3.1, 0.5), props: { text: '( feega )', x: 0.5, y: 0.26, width: 0.8, align: 'center' } },
    { ...title('t1', 'Better marketing\non canvas.', 0.3, 3, 0.5, 0.15), props: { text: 'Better marketing\non canvas.', x: 0.5, y: 0.5, width: 0.9, height: 0.4, align: 'center', size: 0.15 } },
    { id: 'line', component: 'Shape', trackId: 'media', from: s(1), durationInFrames: s(2.3), props: { shape: 'line', y: 0.74, width: 0.5, height: 0.004 }, transitionOut: OUT },
    kicker('k2', '( 01 ) The canvas', 3.3, 4),
    title('t2', 'One\ninfinite\ncanvas.', 3.4, 3.9),
    { id: 'mock', component: 'CanvasMock', trackId: 'media', from: s(3.5), durationInFrames: s(3.8), props: { x: 0.72, y: 0.5, width: 0.5, height: 0.72, assetId: assets.imageId }, transitionIn: { kind: TransitionKind.SlideUp, durationInFrames: 14 }, transitionOut: OUT },
    kicker('k3', '( 02 ) 3D', 7.4, 3.9),
    title('t3', 'Products,\nin 3D.', 7.5, 3.8),
    assets.modelId
      ? { id: 'model', component: 'Model3D', trackId: 'media', from: s(7.5), durationInFrames: s(3.8), props: { assetId: assets.modelId, x: 0.72, y: 0.5, width: 0.5, height: 0.9, startAngle: -40, endAngle: 140, zoom: 1.1 }, transitionIn: { kind: TransitionKind.Scale, durationInFrames: 14 }, transitionOut: OUT }
      : { id: 'model', component: 'Shape3D', trackId: 'media', from: s(7.5), durationInFrames: s(3.8), props: { shape: 'torus', x: 0.72, y: 0.5, width: 0.5, height: 0.9, orbitSpeed: 60 }, transitionIn: { kind: TransitionKind.Scale, durationInFrames: 14 }, transitionOut: OUT },
    kicker('k4', '( 03 ) Publish', 11.4, 3.2),
    title('t4', 'Ship it\neverywhere.', 11.5, 3.1),
    { id: 'post', component: 'SocialMockup', trackId: 'media', from: s(11.5), durationInFrames: s(3.1), props: { assetId: assets.imageId, handle: '@feega', caption: 'Made on one canvas.', x: 0.72, y: 0.5, width: 0.3, height: 0.86 }, transitionIn: { kind: TransitionKind.SlideLeft, durationInFrames: 14 }, transitionOut: OUT },
    { ...kicker('k5', 'feega.app', 14.8, 3.2, 0.5), props: { text: 'feega.app', x: 0.5, y: 0.68, width: 0.6, align: 'center' } },
    { ...title('t5', 'Start on\nthe canvas.', 14.7, 3.3, 0.5, 0.15), props: { text: 'Start on\nthe canvas.', x: 0.5, y: 0.45, width: 0.9, height: 0.4, align: 'center', size: 0.15 } }
  ];
}

export function feegaTrailer(assets: TrailerAssets): MotionDoc {
  let result: OpResult = setCanvas(newMotionDoc(MotionFormat.Landscape), { durationInFrames: s(18) });
  const tracks: [TrackKind, string, string][] = [
    [TrackKind.Visual, 'media', 'Media'],
    [TrackKind.Visual, 'text', 'Text']
  ];
  for (const [kind, id, name] of tracks) {
    result = result.ok ? addTrack(result.doc, kind, id, name) : result;
  }
  result = result.ok ? { ok: true, doc: { ...result.doc, tracks: result.doc.tracks.map((t) => (t.id === 'v1' ? { ...t, id: 'bg', name: 'Background' } : t)) } } : result;

  for (const { id, ...clip } of beats(assets)) {
    result = result.ok ? addClip(result.doc, clip, id) : result;
  }
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}
