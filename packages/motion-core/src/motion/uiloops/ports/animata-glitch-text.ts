import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'animata-glitch-text',
  title: 'Glitch text',
  about: 'Text with magenta and cyan ghosts that jolt apart in a short glitch burst, then settle. A quick RGB jolt that settles; RenderComp Glitch text keeps tearing longer.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#0a0a0b',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Glitch', group: 'Content', maxLength: 60 },
    intensity: { type: 'number', title: 'Intensity', default: 5, minimum: 1, maximum: 20, step: 1, group: 'Motion' },
    step: { type: 'number', title: 'Step (em)', default: 0.01, minimum: 0.002, maximum: 0.05, step: 0.002, group: 'Motion' },
    duration: { type: 'number', title: 'Duration (s)', default: 2.5, minimum: 0.5, maximum: 10, step: 0.1, group: 'Motion' },
    baseColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#fafafa', group: 'Style' },
    colorA: { type: 'string', title: 'Ghost colour A', format: PropFormat.Color, default: '#ff00ff', group: 'Style' },
    colorB: { type: 'string', title: 'Ghost colour B', format: PropFormat.Color, default: '#00ffff', group: 'Style' },
    fontSize: { type: 'number', title: 'Font size', default: 220, minimum: 20, maximum: 400, step: 1, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const CSS_EASE = S.Easing.bezier(0.25, 0.1, 0.25, 1);
    const intensity = Number(p.intensity);
    const step = Number(p.step);
    const y = Math.max(step, intensity * step * 0.35);
    const x = intensity * step;
    const x1 = (intensity - 1) * step;
    const x2 = (intensity - 2) * step;
    const A = { at: [0, 0.88, 0.9, 0.92, 0.94, 0.96, 1], x: [0, 0, -x, x1, -x2, x, 0], y: [0, 0, -y, y, 0, -y, 0], o: [0.85, 0.85, 1, 0.9, 1, 0.85, 0.85] };
    const B = { at: [0, 0.86, 0.88, 0.91, 0.93, 0.95, 1], x: [0, 0, x, -x, x1, -x2, 0], y: [0, 0, y, -y, 0, y, 0], o: [0.85, 0.85, 1, 0.9, 1, 0.85, 0.85] };
    const face = { fontWeight: 800, fontSize: Number(p.fontSize), fontFamily: S.pick(p.fontFamily, 'Inter'), gridArea: '1 / 1', whiteSpace: 'nowrap' } as const;
    const ghostA = S.h('span', { style: { ...face, color: String(p.colorA), mixBlendMode: 'screen' } }, String(p.text)) as HTMLElement;
    const ghostB = S.h('span', { style: { ...face, color: String(p.colorB), mixBlendMode: 'screen' } }, String(p.text)) as HTMLElement;
    const base = S.h('span', { style: { ...face, position: 'relative', zIndex: 2, color: String(p.baseColor) } }, String(p.text));
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, S.h('span', { style: { position: 'relative', display: 'inline-grid' } }, ghostA, ghostB, base)));

    const put = (el: HTMLElement, track: typeof A, phase: number) => {
      const at = (values: number[]) => S.interpolate(phase, track.at, values, { easing: CSS_EASE });
      el.style.transform = `translate(${at(track.x)}em, ${at(track.y)}em)`;
      el.style.opacity = String(at(track.o));
    };

    return (frame) => {
      const phase = S.cycle(frame, view.fps, Number(p.duration));
      put(ghostA, A, phase);
      put(ghostB, B, phase);
    };
  }
};
