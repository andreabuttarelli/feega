import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'mk-clone-wall-transition',
  title: 'Clone wall transition',
  about: 'The frame shrinks to a rounded card on a wall of repeated words, an inverting sweep flips the wall, then it fades off.',
  category: HfCategory.Transition,
  origin: HfOrigin.Block,
  source: 'mk-clone-wall-transition',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 72,
  background: '#0f1115',
  fonts: ['Inter'],
  props: {
    word: { type: 'string', title: 'Word', default: 'Motion', group: 'Content', maxLength: 24 },
    cardImage: { type: 'string', title: 'Card picture', format: PropFormat.Asset, assetKind: 'image', default: null, group: 'Content' },
    ink: { type: 'string', title: 'Ink', format: PropFormat.Color, default: '#1d1d1f', group: 'Style' },
    paper: { type: 'string', title: 'Paper', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    blob1: { type: 'string', title: 'Card colour 1', format: PropFormat.Color, default: '#ff7ac8', group: 'Style' },
    blob2: { type: 'string', title: 'Card colour 2', format: PropFormat.Color, default: '#45d6c8', group: 'Style' },
    fontSize: { type: 'number', title: 'Text size', default: 240, minimum: 60, maximum: 400, step: 10, group: 'Style' },
    spreadX: { type: 'number', title: 'Spread X', default: 90, minimum: 0, maximum: 300, step: 10, group: 'Layout' },
    spreadY: { type: 'number', title: 'Spread Y', default: 60, minimum: 0, maximum: 300, step: 10, group: 'Layout' },
    brickOffset: { type: 'boolean', title: 'Brick offset', default: true, group: 'Layout' },
    driftX: { type: 'number', title: 'Drift', default: -46, minimum: -300, maximum: 300, step: 2, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const word = String(p.word || 'Motion');
    const size = Number(p.fontSize) || 240;
    const spreadX = Number(p.spreadX);
    const spreadY = Number(p.spreadY);
    const brick = p.brickOffset !== false && p.brickOffset !== 'false';
    const rowH = size + spreadY;
    const rows = Math.ceil(H / rowH) + 1;
    const tileW = word.length * size * 0.58 + spreadX;
    const perRow = Math.ceil(W / tileW) + 2;

    const lines = Array.from({ length: rows }, (_, r) => {
      const offset = brick && r % 2 === 1 ? -Math.round(tileW / 2) : 0;
      const tiles = Array.from({ length: perRow + 1 }, () => S.h('span', { style: { display: 'inline-block', marginRight: spreadX } }, word));
      return S.h('div', { style: { position: 'absolute', whiteSpace: 'nowrap', fontFamily: 'Inter, -apple-system, sans-serif', fontWeight: 600, letterSpacing: '-0.02em', color: String(p.ink), lineHeight: 1, fontSize: size, top: r * rowH - size * 0.35, left: offset - tileW } }, ...tiles);
    });

    const tiles = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } }, ...lines) as HTMLElement;
    const invert = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: String(p.paper), mixBlendMode: 'difference' } }) as HTMLElement;
    const wall = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: String(p.paper), isolation: 'isolate' } }, tiles, invert) as HTMLElement;
    const picture = p.cardImage ? S.h('img', { src: String(p.cardImage), style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' } }) : null;
    const card = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: W, height: H, borderRadius: 0, overflow: 'hidden', background: `linear-gradient(120deg, #fdfbfd 0%, ${String(p.blob1)} 38%, ${String(p.blob2)} 100%)`, boxShadow: '0 30px 80px rgba(0, 0, 0, 0.22)', transformOrigin: '50% 50%' } }, picture) as HTMLElement;
    const stage = S.fill({}, wall, card) as HTMLElement;
    view.root.replaceChildren(stage);

    const tl = S.timeline();
    tl.set(card, { x: 0, y: 0, width: W, height: H, borderRadius: 0, scale: 1, opacity: 1 }, 0);
    tl.set(invert, { x: -W }, 0);
    tl.to(card, { y: 330, x: 640, width: 640, height: 420, borderRadius: 40, duration: 0.75, ease: 'power3.inOut' }, 0.2);
    tl.to(card, { scale: 0.6, opacity: 0, duration: 0.4, ease: 'power2.in' }, 1.35);
    tl.to(tiles, { x: Number(p.driftX) || 0, duration: 1.8, ease: 'sine.inOut' }, 0.3);
    tl.to(invert, { x: 0, duration: 0.65, ease: 'power3.inOut' }, 0.85);
    tl.to(wall, { opacity: 0, duration: 0.45, ease: 'power2.inOut' }, 1.9);
    tl.set(card, { visibility: 'hidden' }, 1.76);
    tl.set(stage, { visibility: 'hidden' }, 2.36);

    return (frame) => tl.render(frame / view.fps);
  }
};
