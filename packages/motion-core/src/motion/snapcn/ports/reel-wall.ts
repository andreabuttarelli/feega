import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'reel-wall',
  title: 'Reel wall',
  about: 'A curved wall of vertical clips turns past in the dark, easing in from rest and then turning at an even speed.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 24,
  frames: 216,
  background: '#0e0e0e',
  fonts: [],
  props: {
    videos: { type: 'string', title: 'Clips', format: PropFormat.Media, default: '', group: 'Content', maxLength: 2000 },
    cardColor: { type: 'string', title: 'Card colour', format: PropFormat.Color, default: '#1a1a1a', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const REF_W = 716;
    const REF_H = 398;
    const CARD = { w: 201.92, h: 349.09 };
    const RING_R = 1837.36;
    const PERSPECTIVE = 446.54;
    const PITCH = 0.1328;
    const ORIGIN = { x: 356.76, y: 197.99 };
    const CRUISE_AT = 52;
    const CARDS = 10;
    const ease = S.Easing.bezier(0.344, 0.0049, 0.7833, 1.3384);
    const easeIn = (step: number) => S.interpolate(step, [0, 67.8], [-0.0497, -0.2656], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
    const CRUISE = easeIn(CRUISE_AT) - easeIn(CRUISE_AT - 1);
    const wallTurn = (step: number) => (step <= CRUISE_AT ? easeIn(step) : easeIn(CRUISE_AT) + (step - CRUISE_AT) * CRUISE);
    const veil = (f: number) => (f >= 9 ? 0 : 0.142 * (1 - Math.max(f, 0) / 9) ** 3.7);
    const onTwos = (f: number) => (f < 1 ? 0 : Math.floor((f - 1) / 2) * 2 + 1);

    const videos = S.media(p.videos);
    const speed = Number(p.speed);
    const cardColor = String(p.cardColor);
    const u = view.width / REF_W;
    const dy = (view.height - REF_H * u) / 2;

    const cards = Array.from({ length: CARDS }, () => {
      const video = S.h('video', { muted: true, playsinline: true, preload: 'auto', style: { width: '100%', height: '100%', maxWidth: 'none', objectFit: 'cover', display: 'block' } }) as HTMLVideoElement;
      video.muted = true;
      const el = S.h('div', { style: { position: 'absolute', left: (ORIGIN.x - CARD.w / 2) * u, top: (ORIGIN.y - CARD.h / 2) * u, width: CARD.w * u, height: CARD.h * u, overflow: 'hidden', backgroundColor: cardColor } }, video) as HTMLElement;
      return { el, video, src: '' };
    });
    const page = S.h('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 75% at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 70%, rgba(0,0,0,0.92) 100%)' } });
    const stage = S.h('div', { style: { position: 'absolute', left: 0, top: dy, width: view.width, height: REF_H * u, perspective: `${PERSPECTIVE * u}px`, perspectiveOrigin: `${ORIGIN.x * u}px ${ORIGIN.y * u}px` } }, page, cards.map((c) => c.el));
    const shade = S.h('div', { style: { position: 'absolute', inset: 0, background: '#000', opacity: 0 } }) as HTMLElement;
    view.root.replaceChildren(S.fill({ overflow: 'hidden', background: 'transparent' }, stage, shade));

    const show = (card: (typeof cards)[number], src: string, seconds: number) => {
      card.video.style.display = src ? 'block' : 'none';
      if (!src) {
        return;
      }
      if (card.src !== src) {
        card.src = src;
        card.video.src = src;
      }
      card.video.currentTime = seconds;
    };

    return (at) => {
      const frame = at * ((speed * 24) / view.fps);
      const held = onTwos(Math.floor(frame));
      const theta = wallTurn((held + 1) / 2);
      const first = Math.floor((-theta - 0.6) / PITCH);
      const n = videos.length;
      cards.forEach((card, i) => {
        const k = first + i;
        card.el.style.transform = `translateZ(${-RING_R * u}px) rotateY(${theta + k * PITCH}rad) translateZ(${RING_R * u}px)`;
        show(card, n ? videos[((k % n) + n) % n] : '', held / 24);
      });
      const v = veil(frame);
      shade.style.display = v > 0 ? 'block' : 'none';
      shade.style.opacity = String(v);
    };
  }
};
