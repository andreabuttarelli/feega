import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'whip-pan',
  title: 'Whip pan',
  about: 'A fast horizontal pan with motion blur whips from one full-screen scene to the next, three scenes in a row.',
  category: RendercompCategory.Transition,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#000000',
  fonts: [],
  props: {
    title1: { type: 'string', title: 'Scene 1 title', default: 'Discover', group: 'Content', maxLength: 40 },
    subtitle1: { type: 'string', title: 'Scene 1 subtitle', default: 'Stories that move', group: 'Content', maxLength: 80 },
    background1: { type: 'string', title: 'Scene 1 background', format: PropFormat.Color, default: '#0f172a', group: 'Style' },
    textColor1: { type: 'string', title: 'Scene 1 text colour', format: PropFormat.Color, default: '#f1f5f9', group: 'Style' },
    title2: { type: 'string', title: 'Scene 2 title', default: 'Create', group: 'Content', maxLength: 40 },
    subtitle2: { type: 'string', title: 'Scene 2 subtitle', default: 'Built for impact', group: 'Content', maxLength: 80 },
    background2: { type: 'string', title: 'Scene 2 background', format: PropFormat.Color, default: '#7c3aed', group: 'Style' },
    textColor2: { type: 'string', title: 'Scene 2 text colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    title3: { type: 'string', title: 'Scene 3 title', default: 'Deliver', group: 'Content', maxLength: 40 },
    subtitle3: { type: 'string', title: 'Scene 3 subtitle', default: 'Ready to ship', group: 'Content', maxLength: 80 },
    background3: { type: 'string', title: 'Scene 3 background', format: PropFormat.Color, default: '#ea580c', group: 'Style' },
    textColor3: { type: 'string', title: 'Scene 3 text colour', format: PropFormat.Color, default: '#fff7ed', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    panLeft: { type: 'boolean', title: 'Pan left', default: true, group: 'Motion' },
    maxBlur: { type: 'number', title: 'Max blur (px)', default: 24, minimum: 0, maximum: 80, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height, frames } = view;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const maxBlur = Number(p.maxBlur);
    const direction = p.panLeft ? -1 : 1;
    const big = width >= 1920;

    const scenes = [1, 2, 3].map((n) => ({
      background: String(p[`background${n}`]),
      title: String(p[`title${n}`]),
      subtitle: String(p[`subtitle${n}`]),
      textColor: String(p[`textColor${n}`])
    }));
    const sceneCount = scenes.length;
    const segmentDuration = frames / sceneCount;
    const transitionStart = segmentDuration - segmentDuration * 0.4;

    const pane = (scene: (typeof scenes)[number]) =>
      S.h('div', { style: { width, height, backgroundColor: scene.background, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: face, color: scene.textColor, gap: 28, padding: 80, boxSizing: 'border-box' } },
        S.h('div', { style: { fontSize: big ? 132 : 92, fontWeight: 900, letterSpacing: 4, textAlign: 'center', lineHeight: 1.15 } }, scene.title),
        scene.subtitle ? S.h('div', { style: { fontSize: big ? 40 : 32, fontWeight: 500, letterSpacing: 2, opacity: 0.85, textAlign: 'center' } }, scene.subtitle) : null
      );
    const layer = () => S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } }) as HTMLElement;

    const current = layer();
    const next = layer();
    const panes = scenes.map(pane);
    view.root.replaceChildren(S.fill({ backgroundColor: '#000', overflow: 'hidden' }, current, next));

    return (frame) => {
      const currentIndex = Math.min(Math.floor(frame / segmentDuration), sceneCount - 1);
      const localFrame = frame - currentIndex * segmentDuration;
      const isLast = currentIndex === sceneCount - 1;
      const nextIndex = Math.min(currentIndex + 1, sceneCount - 1);

      const panProgress = !isLast && localFrame >= transitionStart
        ? S.interpolate(localFrame, [transitionStart, segmentDuration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: S.Easing.inOut(S.Easing.cubic) })
        : 0;
      const blur = `blur(${Math.sin(panProgress * Math.PI) * maxBlur}px)`;

      current.replaceChildren(panes[currentIndex]);
      current.style.transform = `translateX(${panProgress * width * direction}px)`;
      current.style.filter = blur;

      next.style.display = !isLast && panProgress > 0 ? 'block' : 'none';
      if (next.style.display === 'none') {
        return;
      }

      next.replaceChildren(panes[nextIndex]);
      next.style.transform = `translateX(${(1 - panProgress) * width * -direction}px)`;
      next.style.filter = blur;
    };
  }
};
