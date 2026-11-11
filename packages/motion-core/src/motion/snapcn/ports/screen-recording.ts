import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'screen-recording',
  title: 'Screen recording',
  about: 'A screen capture fades in from a blur, the camera pushes in on one spot, holds, then eases back out to the full shot.',
  category: SnapcnCategory.Screen,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 139,
  background: '#faf9f6',
  fonts: [],
  props: {
    src: { type: 'string', title: 'Screenshot', format: PropFormat.Asset, assetKind: 'image', default: null, group: 'Content', maxLength: 2000 },
    sourceAspect: { type: 'number', title: 'Source aspect (0 = frame)', default: 0, minimum: 0, maximum: 4, step: 0.01, group: 'Content' },
    fit: { type: 'string', title: 'Fit', enum: ['cover', 'contain'], default: 'cover', group: 'Content' },
    cropTop: { type: 'number', title: 'Crop top (fraction)', default: 0, minimum: 0, maximum: 0.9, step: 0.01, group: 'Content' },
    cropRight: { type: 'number', title: 'Crop right (fraction)', default: 0, minimum: 0, maximum: 0.9, step: 0.01, group: 'Content' },
    cropBottom: { type: 'number', title: 'Crop bottom (fraction)', default: 0, minimum: 0, maximum: 0.9, step: 0.01, group: 'Content' },
    cropLeft: { type: 'number', title: 'Crop left (fraction)', default: 0, minimum: 0, maximum: 0.9, step: 0.01, group: 'Content' },
    backdropColor: { type: 'string', title: 'Backdrop (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    radius: { type: 'number', title: 'Corner radius (px)', default: 0, minimum: 0, maximum: 200, step: 1, group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    entrance: { type: 'string', title: 'Entrance', enum: ['fade', 'none'], default: 'fade', group: 'Motion' },
    zoomAt: { type: 'number', title: 'Push-in start (frame)', default: 34, minimum: 0, maximum: 600, step: 1, group: 'Motion' },
    zoomFrames: { type: 'number', title: 'Push-in length (frames)', default: 25, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    zoom: { type: 'number', title: 'Zoom', default: 1.6, minimum: 1, maximum: 5, step: 0.05, group: 'Motion' },
    focusX: { type: 'number', title: 'Focus x (0-1)', default: 0.36, minimum: 0, maximum: 1, step: 0.01, group: 'Motion' },
    focusY: { type: 'number', title: 'Focus y (0-1)', default: 0.42, minimum: 0, maximum: 1, step: 0.01, group: 'Motion' },
    outAt: { type: 'number', title: 'Pull-out start (frame)', default: 96, minimum: 0, maximum: 600, step: 1, group: 'Motion' },
    outFrames: { type: 'number', title: 'Pull-out length (frames)', default: 25, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const EASE = S.Easing.bezier(0.2, 0.6, 0.35, 1);
    const ENTRANCE_START = 4;
    const ENTRANCE_FRAMES = 18;
    const ENTRANCE_BLUR = 8;
    const REST = { zoom: 1, x: 0.5, y: 0.5 };
    const speed = Number(p.speed);
    const W = view.width;
    const H = view.height;

    const moves = [
      { at: Number(p.zoomAt), dur: Number(p.zoomFrames), zoom: Number(p.zoom), x: Number(p.focusX), y: Number(p.focusY) },
      { at: Number(p.outAt), dur: Number(p.outFrames), zoom: 1, x: Number(p.focusX), y: Number(p.focusY) }
    ].sort((a, b) => a.at - b.at);

    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    const progress = (f: number, at: number, dur: number) => (dur <= 0 ? 1 : S.interpolate(f, [at, at + dur], [0, 1], { easing: EASE, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
    const mix = (a: typeof REST, b: typeof REST, k: number) => ({ zoom: lerp(a.zoom, b.zoom, k), x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
    const poseAt = (f: number) => {
      let on = REST;
      let current: { from: typeof REST; to: typeof REST; at: number; dur: number } | null = null;
      for (const m of moves) {
        if (m.at > f) {
          break;
        }
        if (current) {
          on = mix(current.from, current.to, progress(m.at, current.at, current.dur));
        }
        current = { from: on, to: { zoom: m.zoom, x: m.x, y: m.y }, at: m.at, dur: m.dur };
      }
      return current ? mix(current.from, current.to, progress(f, current.at, current.dur)) : on;
    };
    const clampFocus = (v: number, zoom: number) => {
      const lo = 0.5 / zoom;
      const hi = 1 - lo;
      return lo >= hi ? 0.5 : Math.min(Math.max(v, lo), hi);
    };

    const left = Number(p.cropLeft);
    const top = Number(p.cropTop);
    const keepX = Math.max(1 - left - Number(p.cropRight), 0.01);
    const keepY = Math.max(1 - top - Number(p.cropBottom), 0.01);
    const aspect = Number(p.sourceAspect) > 0 ? Number(p.sourceAspect) : W / H;
    const regionW = aspect * keepX;
    const k = p.fit === 'contain' ? Math.min(W / regionW, H / keepY) : Math.max(W / regionW, H / keepY);
    const shotW = regionW * k;
    const shotH = keepY * k;
    const pct = (v: number, of: number) => `${(v / of) * 100}%`;

    const src = String(p.src);
    const media = src ? (S.h('img', { src, style: { position: 'absolute', left: pct(-left * aspect * k, shotW), top: pct(-top * k, shotH), width: pct(aspect * k, shotW), height: pct(k, shotH), maxWidth: 'none', objectFit: 'cover' } }) as HTMLElement) : null;
    const region = S.h('div', { style: { position: 'absolute', left: pct((W - shotW) / 2, W), top: pct((H - shotH) / 2, H), width: pct(shotW, W), height: pct(shotH, H), overflow: 'hidden' } }, media);
    const camera = S.h('div', { style: { position: 'absolute', inset: 0, transformOrigin: '0 0' } }, region) as HTMLElement;
    view.root.replaceChildren(S.fill({ backgroundColor: S.pick(p.backdropColor, String(t.background)), borderRadius: Number(p.radius), overflow: 'hidden' }, camera));

    return (frame) => {
      const f = frame * speed;
      const pose = poseAt(f);
      const tx = (0.5 - clampFocus(pose.x, pose.zoom) * pose.zoom) * 100;
      const ty = (0.5 - clampFocus(pose.y, pose.zoom) * pose.zoom) * 100;
      camera.style.transform = `translate(${tx}%, ${ty}%) scale(${pose.zoom})`;
      if (!media) {
        return;
      }
      const arrival = p.entrance === 'none' ? 1 : S.interpolate(f, [ENTRANCE_START, ENTRANCE_START + ENTRANCE_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      media.style.opacity = String(arrival);
      media.style.filter = arrival < 1 ? `blur(${(1 - arrival) * ENTRANCE_BLUR}px)` : '';
    };
  }
};
