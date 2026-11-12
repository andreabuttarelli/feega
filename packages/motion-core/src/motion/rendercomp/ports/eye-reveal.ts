import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'eye-reveal',
  title: 'Eye reveal',
  about: 'Eyelids retract to open a drawn eye, the iris grows and a word springs in beneath it before the eye closes.',
  category: RendercompCategory.Social,
  width: 1080,
  height: 1080,
  fps: 30,
  frames: 90,
  background: '#0f172a',
  fonts: [],
  props: {
    messageText: { type: 'string', title: 'Message', default: 'Revealed', group: 'Content', maxLength: 40 },
    subText: { type: 'string', title: 'Subtitle', default: 'See the truth', group: 'Content', maxLength: 60 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0f172a', group: 'Style' },
    scleraColor: { type: 'string', title: 'Eye white', format: PropFormat.Color, default: '#f8fafc', group: 'Style' },
    irisColor: { type: 'string', title: 'Iris', format: PropFormat.Color, default: '#3b82f6', group: 'Style' },
    pupilColor: { type: 'string', title: 'Pupil', format: PropFormat.Color, default: '#0f172a', group: 'Style' },
    lidColor: { type: 'string', title: 'Eyelids', format: PropFormat.Color, default: '#1e293b', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#f8fafc', group: 'Style' },
    subColor: { type: 'string', title: 'Subtitle colour', format: PropFormat.Color, default: '#94a3b8', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const FPS = 30;
    const width = view.width;
    const height = view.height;
    const FONT = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const CUBIC_OUT = S.Easing.out(S.Easing.cubic);
    const LASH_OFFSETS = [-0.4, -0.2, 0, 0.2, 0.4];
    const RAYS = 8;

    const scale = Math.min(width, height);
    const cx = width / 2;
    const cy = height * 0.42;
    const ew = scale * 0.3;
    const eh = scale * 0.14;
    const lidColor = String(p.lidColor);

    const svg = (tag: string, attrs: Record<string, unknown>) => S.h(tag, attrs) as unknown as SVGElement;

    const clipShape = svg('path', {});
    const clip = S.h('clipPath', { id: 'eyeClip' }, clipShape);
    const white = svg('path', { fill: String(p.scleraColor) });
    const iris = svg('circle', { cx, cy, fill: String(p.irisColor), clipPath: 'url(#eyeClip)' });
    const rays = Array.from({ length: RAYS }, () => svg('line', { stroke: 'white', strokeWidth: scale * 0.003, opacity: 0.2, clipPath: 'url(#eyeClip)' }));
    const pupil = svg('circle', { cx, cy, fill: String(p.pupilColor), clipPath: 'url(#eyeClip)' });
    const highlight = svg('circle', { cx: cx - eh * 0.18, cy: cy - eh * 0.2, fill: 'white', opacity: 0.7, clipPath: 'url(#eyeClip)' });
    const upperLid = svg('path', { fill: lidColor });
    const lowerLid = svg('path', { fill: lidColor });
    const lashes = LASH_OFFSETS.map(() => svg('line', { stroke: lidColor, strokeWidth: scale * 0.006, strokeLinecap: 'round' }));

    const canvas = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } }, S.h('defs', null, clip), white, iris, rays, pupil, highlight, upperLid, lowerLid, lashes);

    const messageEl = S.h('div', { style: { fontFamily: FONT, fontSize: scale * 0.09, fontWeight: 900, color: String(p.textColor) } }, String(p.messageText)) as HTMLElement;
    const subEl = S.h('div', { style: { fontFamily: FONT, fontSize: scale * 0.034, fontWeight: 500, color: String(p.subColor) } }, String(p.subText)) as HTMLElement;
    const caption = S.h('div', { style: { position: 'absolute', bottom: height * 0.1, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: scale * 0.01 } }, messageEl, subEl);

    view.root.replaceChildren(S.fill({ backgroundColor: String(p.backgroundColor) }, canvas, caption));

    const set = (el: SVGElement, attrs: Record<string, number | string>) => {
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    };

    return (frame) => {
      const eyeOpen = S.interpolate(frame, [5, 35], [0, 1], { ...clamped, easing: CUBIC_OUT });
      const irisIn = S.spring({ frame: frame - 25, fps: FPS, config: { damping: 11, stiffness: 100 }, durationInFrames: 20 });
      const blinkClose = S.interpolate(frame, [60, 64], [0, 1], clamped);
      const blinkOpen = S.interpolate(frame, [64, 70], [1, 0], clamped);
      const openAmount = frame >= 60 ? (frame >= 64 ? blinkOpen : 1 - blinkClose) : eyeOpen;
      const textIn = S.spring({ frame: frame - 52, fps: FPS, config: { damping: 12, stiffness: 120 }, durationInFrames: 18 });
      const subIn = S.interpolate(frame, [66, 80], [0, 1], clamped);
      const lidGap = openAmount * eh;
      const grow = irisIn * openAmount;

      const eyePath = `M ${cx - ew / 2} ${cy} Q ${cx} ${cy - lidGap} ${cx + ew / 2} ${cy} Q ${cx} ${cy + lidGap} ${cx - ew / 2} ${cy} Z`;
      set(clipShape, { d: eyePath });
      set(white, { d: eyePath });

      set(iris, { r: eh * 0.9 * grow });
      rays.forEach((ray, i) => {
        const a = (i / RAYS) * Math.PI * 2;
        const r1 = eh * 0.35 * grow;
        const r2 = eh * 0.85 * grow;
        set(ray, { x1: cx + Math.cos(a) * r1, y1: cy + Math.sin(a) * r1, x2: cx + Math.cos(a) * r2, y2: cy + Math.sin(a) * r2 });
      });
      set(pupil, { r: eh * 0.42 * grow });
      set(highlight, { r: eh * 0.12 * grow });

      set(upperLid, { d: `M ${cx - ew / 2 - scale * 0.02} ${cy - eh * 0.5} L ${cx + ew / 2 + scale * 0.02} ${cy - eh * 0.5} L ${cx + ew / 2} ${cy} Q ${cx} ${cy - lidGap} ${cx - ew / 2} ${cy} Z` });
      set(lowerLid, { d: `M ${cx - ew / 2 - scale * 0.02} ${cy + eh * 0.5} L ${cx + ew / 2 + scale * 0.02} ${cy + eh * 0.5} L ${cx + ew / 2} ${cy} Q ${cx} ${cy + lidGap} ${cx - ew / 2} ${cy} Z` });

      lashes.forEach((lash, i) => {
        const t = LASH_OFFSETS[i];
        const lx = cx + t * ew * 0.9;
        const ly1 = cy - lidGap;
        set(lash, { x1: lx, y1: ly1, x2: lx + t * scale * 0.008, y2: ly1 - scale * (0.016 + Math.abs(t) * 0.008) });
      });

      messageEl.style.opacity = String(textIn);
      messageEl.style.transform = `scale(${0.75 + textIn * 0.25})`;
      subEl.style.opacity = String(subIn);
    };
  }
};
