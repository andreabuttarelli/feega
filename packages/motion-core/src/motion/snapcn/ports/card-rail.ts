import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'card-rail',
  title: 'Card rail',
  about: 'A tilted rail of scene cards flicks sideways under a heading, three swipes that ease out like a real trackpad throw.',
  category: SnapcnCategory.Screen,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 54,
  background: '#faf9f6',
  fonts: ['Figtree'],
  props: {
    heading: { type: 'string', title: 'Heading', default: 'Browse scenes', group: 'Content', maxLength: 80 },
    cards: { type: 'string', title: 'Cards (title>note>tag | ...)', default: 'Orbit Gallery>Scene · 300 frames>feega.app/orbit-gallery|Moodboard Reveal>Scene · 150 frames>feega.app/moodboard-reveal|Hero Launch>Scene · 170 frames>feega.app/hero-launch|Phone Frame>Scene · 240 frames>feega.app/phone-frame|Count Grid>Scene · 47 frames>feega.app/count-grid|Terminal Simulator>Scene · 200 frames>feega.app/terminal-simulator|Logo Flicker>Scene · 100 frames>feega.app/logo-flicker|Laptop Frame>Scene · 240 frames>feega.app/laptop-frame|Announce Title>Scene · 170 frames>feega.app/announce-title', group: 'Content', maxLength: 2000 },
    from: { type: 'number', title: 'First flick (frame)', default: 0, minimum: 0, maximum: 600, step: 1, group: 'Motion' },
    flicks: { type: 'number', title: 'Flicks', default: 3, minimum: 1, maximum: 20, step: 1, group: 'Motion' },
    every: { type: 'number', title: 'Frames between flicks', default: 30, minimum: 1, maximum: 300, step: 1, group: 'Motion' },
    offset: { type: 'number', title: 'Rail offset (px at 396p)', default: 0, minimum: -2000, maximum: 2000, step: 1, group: 'Motion' },
    backdropImage: { type: 'string', title: 'Backdrop image', format: PropFormat.Asset, assetKind: 'image', default: null, group: 'Style', maxLength: 2000 },
    cardImages: { type: 'string', title: 'Card images, in card order', format: PropFormat.Media, default: '', group: 'Content', maxLength: 2000 },
    backdrop: { type: 'string', title: 'Backdrop (colour | colour)', default: '', group: 'Style', maxLength: 2000 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Figtree', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const REF_W = 714;
    const REF_H = 396;
    const HEAD_CAP = 20.81;
    const HEAD_BASE = 64.45;
    const CARD_W = 259.2;
    const CARD_TOP = 79.8;
    const GAP = 54.2;
    const RADIUS = 10;
    const CARD_H = 323.3;
    const SHOT = CARD_W / (16 / 9);
    const DEPTH = 740;
    const TILT = 30;
    const HORIZON = 300;
    const ANGLE = 138;
    const TRAVEL = 323;
    const FLICK = [[0, 0], [0.0333, 0.009], [0.0667, 0.0338], [0.1, 0.07508], [0.1333, 0.13213], [0.1667, 0.21021], [0.2, 0.2973], [0.225, 0.38138], [0.2583, 0.45345], [0.2917, 0.51351], [0.325, 0.56757], [0.3583, 0.60961], [0.3917, 0.65165], [0.4333, 0.68468], [0.4583, 0.71171], [0.4917, 0.73874], [0.525, 0.76276], [0.5583, 0.78378], [0.5917, 0.8018], [0.625, 0.81982], [0.6583, 0.83483], [0.6917, 0.84985], [0.73, 0.86186], [0.7633, 0.87387], [0.7967, 0.88288], [0.8383, 0.89189], [0.8717, 0.9009], [0.905, 0.90991], [0.9383, 0.91592], [0.9717, 0.92492], [0.9967, 0.93093], [1.03, 0.93694], [2.2, 1]];
    const read = (x: number) => {
      if (x <= FLICK[0][0]) {
        return FLICK[0][1];
      }
      for (let i = 1; i < FLICK.length; i++) {
        const [hx, hy] = FLICK[i];
        const [lx, ly] = FLICK[i - 1];
        if (x <= hx) {
          return ly + ((hy - ly) * (x - lx)) / (hx - lx);
        }
      }
      return 1;
    };

    const W = view.width;
    const H = view.height;
    const u = H / REF_H;
    const ox = (W - REF_W * u) / 2;
    const from = Number(p.from);
    const flicks = Math.max(1, Math.round(Number(p.flicks)));
    const every = Number(p.every);
    const offset = Number(p.offset);
    const face = S.pick(p.fontFamily, 'Figtree');
    const split = (s: string, sep: string) => s.split(sep).map((v) => v.trim());
    const pictures = S.media(p.cardImages);
    const deck = String(p.cards).split('|').filter((c) => c.trim()).map((c, i) => {
      const [title = '', note = '', tag = ''] = split(c, '>');
      return { image: pictures[i] ?? '', title, note, tag };
    });
    const count = Math.max(1, deck.length);
    const stops = split(String(p.backdrop), '|').filter(Boolean);
    const plateSrc = String(p.backdropImage);
    const from0 = plateSrc ? '' : (stops[0] ?? S.mixOklch(String(t.primary), '#0b1f3d', 0.55));
    const to0 = plateSrc ? S.mixOklch(String(t.primary), '#dceaff', 0.78) : (stops[1] ?? S.mixOklch(String(t.primary), '#dceaff', 0.78));
    const pitch = CARD_W + GAP;
    const span = Math.ceil(REF_W / pitch) + 3;

    const plate = (src: string, style: Record<string, string | number>) => (src ? S.h('img', { src, alt: '', style: { ...style, maxWidth: 'none' } }) : S.h('div', { style }));
    const cardEl = (k: number) => {
      const c = deck[k] ?? { image: '', title: '', note: '', tag: '' };
      const bodied = Boolean(c.title || c.note || c.tag);
      return S.h('div', { style: { position: 'absolute', left: 0, top: CARD_TOP * u, width: CARD_W * u, height: CARD_H * u, borderRadius: RADIUS * u, overflow: 'hidden', background: t.card } },
        plate(c.image, { display: 'block', width: CARD_W * u, height: (bodied ? SHOT : CARD_H) * u, objectFit: 'cover' }),
        bodied && S.h('div', { style: { padding: `${13 * u}px ${15 * u}px` } },
          S.h('div', { style: { fontSize: 15 * u, lineHeight: 1.25, fontWeight: 700, color: t.foreground } }, c.title),
          S.h('div', { style: { marginTop: 5 * u, fontSize: 12.5 * u, lineHeight: 1.3, color: t.mutedForeground } }, c.note),
          c.tag && S.h('div', { style: { marginTop: 14 * u, display: 'inline-block', padding: `${5 * u}px ${10 * u}px`, borderRadius: 999, fontSize: 11.5 * u, lineHeight: 1.2, fontWeight: 500, color: t.mutedForeground, border: `1px solid ${t.border}` } }, c.tag))) as HTMLElement;
    };

    const travelAt = (frame: number) => {
      let sum = 0;
      for (let k = 0; k < flicks; k++) {
        sum += TRAVEL * read((frame - from - k * every) / view.fps);
      }
      return sum;
    };
    const firstAt = (frame: number) => Math.max(0, Math.floor((travelAt(frame) - offset) / pitch));
    const last = firstAt(Number.MAX_SAFE_INTEGER) + span;
    const cards = Array.from({ length: last }, (_, i) => cardEl(((i % count) + count) % count));

    const tilt = S.h('div', { style: { position: 'absolute', inset: 0, transform: `rotateX(${TILT}deg)`, transformOrigin: `50% ${HORIZON * u}px`, transformStyle: 'preserve-3d' } }, cards) as HTMLElement;
    const stage = S.h('div', { style: { position: 'absolute', left: ox, top: 0, width: REF_W * u, height: REF_H * u, fontFamily: face, fontOpticalSizing: 'none', textRendering: 'geometricPrecision', overflow: 'hidden' } },
      String(p.heading) && S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: (HEAD_BASE - HEAD_CAP * 1.32) * u, textAlign: 'center', fontSize: HEAD_CAP * 1.38 * u, lineHeight: 1, fontWeight: 500, color: S.mixOklch(to0, String(t.background), 0.62) } }, String(p.heading)),
      S.h('div', { style: { position: 'absolute', inset: 0, perspective: DEPTH * u, perspectiveOrigin: `50% ${HORIZON * u}px` } }, tilt));
    const back = plateSrc ? { backgroundColor: t.background } : { background: `linear-gradient(${ANGLE}deg, ${from0}, ${to0})` };
    view.root.replaceChildren(S.fill(back, plateSrc && plate(plateSrc, { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }), stage));

    return (frame) => {
      const travelled = travelAt(frame);
      const first = Math.max(0, Math.floor((travelled - offset) / pitch));
      cards.forEach((el, i) => {
        const shown = i >= first && i < first + span;
        el.style.display = shown ? '' : 'none';
        el.style.left = `${(i * pitch - travelled + offset) * u}px`;
      });
    };
  }
};
