import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'camera-shake',
  title: 'Camera shake',
  about: 'A framed headline sits still, then an impact fires radial rays and a white flash and the whole frame shakes before settling.',
  category: RendercompCategory.Transition,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#111827',
  fonts: [],
  props: {
    title: { type: 'string', title: 'Title', default: 'IMPACT', group: 'Content', maxLength: 40 },
    subtitle: { type: 'string', title: 'Subtitle', default: 'System breach detected', group: 'Content', maxLength: 80 },
    background: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#111827', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#fef3c7', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#f59e0b', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    maxIntensity: { type: 'number', title: 'Shake amplitude (px)', default: 28, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    impactAt: { type: 'number', title: 'Impact at (s)', default: 0.9, minimum: 0, maximum: 3, step: 0.05, group: 'Motion' },
    shakeDuration: { type: 'number', title: 'Shake duration (s)', default: 1.6, minimum: 0.1, maximum: 3, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height, fps } = view;
    const background = String(p.background);
    const textColor = String(p.textColor);
    const accent = String(p.accentColor);
    const maxIntensity = Number(p.maxIntensity);
    const impactFrame = Math.floor(Number(p.impactAt) * fps);
    const shakeFrames = Math.floor(Number(p.shakeDuration) * fps);
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const RAYS = 12;
    const RAY_FRAMES = 30;
    const big = width >= 1920;

    const pseudoRand = (n: number, seed: number) => {
      const v = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };

    const rayEls = Array.from({ length: RAYS }, () => S.h('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: accent, strokeWidth: 6, strokeLinecap: 'round' }) as SVGElement);
    const rays = S.h('svg', { viewBox: `-${width / 2} -${height / 2} ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0 } }, rayEls) as SVGElement;

    const titleBox = S.h('div', { style: { padding: '32px 64px', border: `6px solid ${accent}`, borderRadius: 8, zIndex: 2, backgroundColor: 'rgba(0,0,0,0.25)' } },
      S.h('div', { style: { fontSize: big ? 124 : 84, fontWeight: 900, letterSpacing: 6, textAlign: 'center', lineHeight: 1.15 } }, String(p.title))
    ) as HTMLElement;
    const subtitle = String(p.subtitle) ? S.h('div', { style: { marginTop: 36, fontSize: big ? 36 : 28, fontWeight: 600, letterSpacing: 3, color: accent, zIndex: 2 } }, String(p.subtitle)) : null;

    const scene = S.fill({ alignItems: 'center', justifyContent: 'center', fontFamily: face, color: textColor, backgroundColor: background, position: 'relative', overflow: 'hidden' }, rays, titleBox, subtitle) as HTMLElement;
    const shaker = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } }, scene) as HTMLElement;
    const flash = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#ffffff', opacity: 0, pointerEvents: 'none' } }) as HTMLElement;
    view.root.replaceChildren(S.fill({ backgroundColor: '#000' }, shaker, flash));

    return (frame) => {
      const elapsed = frame - impactFrame;
      const decay = elapsed >= 0 && elapsed <= shakeFrames ? S.interpolate(elapsed, [0, shakeFrames], [1, 0], { ...clamped, easing: S.Easing.out(S.Easing.cubic) }) : 0;
      const shakeX = (pseudoRand(frame, 1) - 0.5) * 2 * maxIntensity * decay;
      const shakeY = (pseudoRand(frame, 2) - 0.5) * 2 * maxIntensity * decay;
      const shakeRot = (pseudoRand(frame, 3) - 0.5) * 2 * 1.5 * decay;
      shaker.style.transform = `translate(${shakeX}px, ${shakeY}px) rotate(${shakeRot}deg)`;

      flash.style.opacity = String(S.interpolate(elapsed, [0, 3, 10], [0, 0.45, 0], clamped));
      scene.style.opacity = String(S.interpolate(frame, [0, 10], [0, 1], clamped));
      titleBox.style.transform = `scale(${S.interpolate(elapsed, [0, 6, 18], [1, 1.08, 1.02], clamped)})`;

      const rayOn = elapsed >= 0 && elapsed <= RAY_FRAMES;
      rays.style.display = rayOn ? 'block' : 'none';
      if (!rayOn) {
        return;
      }

      const progress = S.interpolate(elapsed, [0, RAY_FRAMES], [0, 1], clamped);
      const len = progress * Math.max(width, height) * 0.9;
      rays.style.opacity = String(1 - progress);
      rayEls.forEach((el, i) => {
        const angle = (i / RAYS) * Math.PI * 2;
        el.setAttribute('x2', String(Math.cos(angle) * len));
        el.setAttribute('y2', String(Math.sin(angle) * len));
      });
    };
  }
};
