import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'hero-launch',
  title: 'Hero launch',
  about: 'A full-screen image recedes and tilts, a second slides in beside it, both fall away and the headline comes forward.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#0a0a0b',
  fonts: ['Inter'],
  props: {
    heading: { type: 'string', title: 'Heading', default: 'npx shadcn add @snapcn', group: 'Content', maxLength: 120 },
    image1: { type: 'string', title: 'Left image or clip', format: PropFormat.Media, default: '', group: 'Content', maxLength: 2000 },
    image2: { type: 'string', title: 'Right image or clip', format: PropFormat.Media, default: '', group: 'Content', maxLength: 2000 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'dark', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const bg = String(t.background);
    const card = String(t.card);
    const fg = String(t.foreground);
    const face = S.pick(p.fontFamily, 'Inter');
    const { width, height } = view;
    const s = height / 720;
    const PERSP = 1000;
    const TILT = 17;
    const GAP = 92;
    const OUT = S.Easing.bezier(0.22, 1, 0.36, 1);
    const FALL = S.Easing.bezier(0.5, 0, 0.9, 0.4);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const shade = S.mixOklch(bg, '#000', 0.75);
    const videos: HTMLVideoElement[] = [];

    const media = (src: string) => {
      const fillStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };
      const effective = src || `linear-gradient(135deg,${S.mixOklch(bg, card, 0.55)},${S.mixOklch(bg, card, 0.2)})`;
      if (effective.startsWith('linear-gradient')) {
        return S.h('div', { style: { ...fillStyle, background: effective } });
      }
      if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(effective)) {
        const v = S.h('video', { src: effective, muted: true, playsinline: true, preload: 'auto', style: fillStyle }) as HTMLVideoElement;
        videos.push(v);
        return v;
      }
      return S.h('img', { src: effective, alt: '', style: fillStyle });
    };

    const imageCard = (src: string) =>
      S.h('div', { style: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 30 * s, background: S.mixOklch(bg, card, 0.35), boxShadow: `0 ${20 * s}px ${52 * s}px -${28 * s}px ${S.withAlpha(shade, 0.9)}, inset 0 0 0 1px ${S.withAlpha(fg, 0.22)}` } },
        media(src),
        S.h('div', { style: { position: 'absolute', inset: 0, background: `linear-gradient(to top, ${S.withAlpha(shade, 0.28)} 0%, transparent 32%)` } }),
        S.h('div', { style: { position: 'absolute', left: 26 * s, right: 26 * s, top: 0, height: '1px', background: `linear-gradient(90deg,transparent,${S.withAlpha(fg, 0.5)},transparent)` } }));

    const cardW = 1000 * s;
    const cardH = 620 * s;
    const box = () => S.h('div', { style: { position: 'absolute', left: (width - cardW) / 2, top: 0.3 * height, width: cardW, height: cardH } }) as HTMLElement;
    const tilt = (origin: string, child: Element) => S.h('div', { style: { width: '100%', height: '100%', transformOrigin: origin } }, child) as HTMLElement;

    const leftBox = box();
    const leftZoom = S.h('div', { style: { width: '100%', height: '100%', transformOrigin: 'center center' } }) as HTMLElement;
    const leftTilt = tilt('100% 50%', imageCard(S.media(p.image1)[0] ?? ''));
    leftZoom.append(leftTilt);
    leftBox.append(leftZoom);
    const rightBox = box();
    const rightTilt = tilt('0% 50%', imageCard(S.media(p.image2)[0] ?? ''));
    rightTilt.style.transform = `perspective(${PERSP * s}px) rotateY(${TILT}deg)`;
    rightBox.append(rightTilt);
    const group = S.fill({}, leftBox, rightBox) as HTMLElement;

    const fade = (g: string) => S.h('div', { style: { position: 'absolute', inset: 0, background: g } });
    const vignette = S.fill({ pointerEvents: 'none' }, fade(`linear-gradient(to left, ${bg} 0%, transparent 30%)`), fade(`linear-gradient(to right, ${bg} 0%, transparent 22%)`), fade(`linear-gradient(to top, ${bg} 0%, transparent 30%)`)) as HTMLElement;
    const title = S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: 0.22 * height, padding: `0 ${40 * s}px`, textAlign: 'center', color: fg, fontWeight: 600, letterSpacing: '-0.02em', fontSize: 42 * s } }, String(p.heading)) as HTMLElement;
    view.root.replaceChildren(S.fill({ backgroundColor: bg, fontFamily: face, fontOpticalSizing: 'none' }, group, vignette, title));

    const restOffset = (cardW + GAP * s) / 2;
    return (frame) => {
      const seg = (start: number, dur: number, easing = OUT) => S.interpolate(frame, [start, start + dur], [0, 1], { ...clamped, easing });
      const recede = seg(40, 30);
      const angle = seg(46, 36);
      const slideL = seg(46, 36);
      const slideR = seg(60, 40);
      const drop = seg(122, 34, FALL);
      const tl = seg(126, 40);

      leftBox.style.opacity = String(S.interpolate(frame, [2, 12], [0, 1], clamped));
      leftBox.style.transform = `translateX(${S.interpolate(slideL, [0, 1], [0, -restOffset])}px)`;
      leftZoom.style.transform = `scale(${S.interpolate(recede, [0, 1], [1.5, 1])})`;
      leftTilt.style.transform = `perspective(${PERSP * s}px) rotateY(${S.interpolate(angle, [0, 1], [0, -TILT])}deg)`;
      rightBox.style.opacity = String(S.interpolate(slideR, [0, 0.35], [0, 1], { extrapolateRight: 'clamp' }));
      rightBox.style.transform = `translateX(${S.interpolate(slideR, [0, 1], [1.08 * width, restOffset])}px)`;

      const floatY = Math.sin(frame * 0.09) * 3.5 * s * seg(94, 22) * (1 - drop);
      group.style.transform = `translateY(${S.interpolate(drop, [0, 1], [0, 0.16 * height]) + floatY}px)`;
      vignette.style.opacity = String(seg(50, 40, S.Easing.linear));

      title.style.opacity = String(tl);
      title.style.filter = `blur(${S.interpolate(tl, [0, 1], [10, 0])}px)`;
      title.style.transform = `translateY(${S.interpolate(tl, [0, 1], [40 * s, 0])}px) scale(${S.interpolate(tl, [0, 1], [0.82, 1])})`;
      videos.forEach((v) => {
        v.currentTime = frame / view.fps;
      });
    };
  }
};
