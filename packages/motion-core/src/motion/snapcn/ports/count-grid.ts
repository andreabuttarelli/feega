import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'count-grid',
  title: 'Count grid',
  about: 'Five cards rush in around a count label, then the grid fills the frame while the number jumps.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 47,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    from: { type: 'string', title: 'Count before', default: '5', group: 'Content', maxLength: 20 },
    to: { type: 'string', title: 'Count after', default: '500', group: 'Content', maxLength: 20 },
    noun: { type: 'string', title: 'Noun', default: 'clips', group: 'Content', maxLength: 40 },
    images: { type: 'string', title: 'Image URLs, comma separated (empty = cards)', default: '', group: 'Content', maxLength: 2000 },
    inkFrom: { type: 'string', title: 'Label ink left (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    inkTo: { type: 'string', title: 'Label ink right (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const FACE = 'Count Grid Inter';
    let redraw = () => {};
    if (typeof FontFace !== 'undefined' && ![...document.fonts].some((f) => f.family === FACE)) {
      const loaded = new FontFace(FACE, 'url(https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2) format("woff2")', { weight: '100 900' });
      document.fonts.add(loaded);
      loaded.load().then(() => redraw()).catch(() => undefined);
    }
    const face = S.pick(p.fontFamily, `"${FACE}", Inter`);
    const REF_W = 712;
    const REF_H = 398;
    const ORIGIN = { x: 358.75, y: 207.6 };
    const CELL = { w: 120.5, h: 147 };
    const CARD = { w: 114.5, h: 139.5, radius: 3 };
    const COL_EDGE = 359;
    const ROW_MID = 202.5;
    const SEED = [[-1, -1], [0, -1], [-1, 0], [0, 0], [0, 1]];
    const LABEL = { size: 30, padX: 15, height: 41, radius: 9 };
    const FILL_AT = 37;
    const held = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const PITCH_AT = [0, 7, 9, 11, 13, 15, 17, 19, 22, 26, 29, 31, 36, 37, 38, 39, 40, 41, 42, 43, 45, 46];
    const PITCH = [174, 138.5, 132, 128, 125, 124, 122.5, 121.5, 120, 119.6, 119, 118.5, 118, 117.9, 113, 106, 104, 102, 99.5, 97.5, 96.6, 96.5];
    const { width, height, fps } = view;
    const cards = String(p.images).split(',').map((s) => s.trim()).filter(Boolean);
    const ink0 = S.pick(p.inkFrom, S.mixOklch(String(t.primary), String(t.foreground), 0.5));
    const ink1 = S.pick(p.inkTo, String(t.primary));
    const cardEdge = S.mixOklch(String(t.card), String(t.border), 0.5);
    const speed = Number(p.speed) || 1;
    const k = Math.min(width / REF_W, height / REF_H);
    const ox = (width - REF_W * k) / 2;
    const oy = (height - REF_H * k) / 2;

    const ringOf = (col: number, row: number) => Math.min(...SEED.map(([c, r]) => Math.max(Math.abs(col - c), Math.abs(row - r))));
    const cellIn = (ring: number, f: number) => {
      if (ring === 0) {
        return 1;
      }
      const at = FILL_AT - 1 + (ring - 1);
      return S.interpolate(f, [at, at + 1.5], [0, 1], held);
    };
    const mod = (a: number, n: number) => ((a % n) + n) % n;

    const NS = 'http://www.w3.org/2000/svg';
    const smear = document.createElementNS(NS, 'feGaussianBlur');
    const lateSmear = document.createElementNS(NS, 'feGaussianBlur');
    const defs = S.h('svg', { width: 0, height: 0, style: { position: 'absolute' } },
      S.h('filter', { id: 'count-grid-smear', x: '-40%', y: '-10%', width: '180%', height: '120%' }, smear),
      S.h('filter', { id: 'count-grid-late', x: '-90%', y: '-10%', width: '280%', height: '120%' }, lateSmear));
    const grid = S.h('div', { style: { position: 'absolute', inset: 0 } }) as HTMLElement;
    const text = S.h('span', { style: { backgroundImage: `linear-gradient(90deg, ${ink0} 0%, ${ink1} 100%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } }) as HTMLElement;
    const pill = S.h('div', { style: { display: 'flex', alignItems: 'center', background: t.card, border: `1px solid ${t.border}`, boxShadow: 'none', boxSizing: 'border-box', fontWeight: 400, lineHeight: 1, whiteSpace: 'nowrap', color: ink0, textRendering: 'geometricPrecision' } }, text) as HTMLElement;
    const labelRow = S.h('div', { style: { position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center' } }, pill) as HTMLElement;
    view.root.replaceChildren(S.fill({ background: 'transparent', fontFamily: face, overflow: 'hidden' }, defs, grid, labelRow));

    const card = (x: number, y: number, w: number, hgt: number, g: number, o: number, src: string, late: boolean) => {
      const img = src ? S.h('img', { src, alt: '', style: { width: w, height: hgt, maxWidth: 'none', objectFit: 'cover' } }) : null;
      return S.h('div', { style: { position: 'absolute', left: x - w / 2, top: y - hgt / 2, width: w, height: hgt, borderRadius: CARD.radius * g * k, overflow: 'hidden', background: t.card, boxShadow: `inset 0 0 0 ${Math.max(0.5, 0.9 * g * k)}px ${cardEdge}`, display: 'flex', alignItems: 'center', opacity: o, filter: late ? 'url(#count-grid-late)' : undefined } }, img);
    };

    const render = (frame: number) => {
      redraw = () => render(frame);
      const f = (frame / fps / speed) * fps;
      const s = S.interpolate(f, PITCH_AT, PITCH, held) / CELL.w;
      const blur = S.interpolate(f, [0, 2, 3, 4, 5], [22, 14, 6, 2, 0], held) * k;
      const late = S.interpolate(f, [3, 5, 7, 9], [26, 17, 7, 0], held) * k;
      const at = (v: number, origin: number) => (v - origin) * s + origin;
      const cardW = CARD.w * s * k;
      const cardH = CARD.h * s * k;
      const cols = Math.ceil(REF_W / (CELL.w * s) / 2) + 2;
      const rows = Math.ceil(REF_H / (CELL.h * s) / 2) + 2;
      smear.setAttribute('stdDeviation', `${blur} 0`);
      lateSmear.setAttribute('stdDeviation', `${late} 0`);
      grid.style.filter = blur > 0.35 ? 'url(#count-grid-smear)' : '';
      const nodes: Element[] = [];
      for (let row = -rows; row <= rows; row++) {
        for (let col = -cols; col <= cols; col++) {
          const ring = ringOf(col, row);
          const o = cellIn(ring, f);
          if (o <= 0) {
            continue;
          }
          const cx = at(COL_EDGE + (col + 0.5) * CELL.w, ORIGIN.x) * k + ox;
          const cy = at(ROW_MID + row * CELL.h, ORIGIN.y) * k + oy;
          if (cx < -cardW || cx > width + cardW || cy < -cardH || cy > height + cardH) {
            continue;
          }
          const i = ring === 0 ? mod(2 * mod(col * 2 + row, SEED.length), cards.length) : mod(col * 7 + row * 13, cards.length);
          nodes.push(card(cx, cy, cardW, cardH, s, o, cards[i] ?? '', late > 0.35 && col === -1 && row === 0));
        }
      }
      grid.replaceChildren(...nodes);
      const pillH = LABEL.height * s * k;
      labelRow.style.top = `${at(ROW_MID, ORIGIN.y) * k + oy - pillH / 2}px`;
      labelRow.style.opacity = String(S.interpolate(f, [11, 13, 15, 17, 18], [0, 0.22, 0.55, 0.9, 1], held));
      pill.style.height = `${pillH}px`;
      pill.style.padding = `0 ${LABEL.padX * s * k}px`;
      pill.style.borderRadius = `${LABEL.radius * s * k}px`;
      pill.style.fontSize = `${LABEL.size * s * k}px`;
      text.style.paddingBottom = `${0.14 * LABEL.size * s * k}px`;
      text.textContent = `${f >= FILL_AT ? String(p.to) : String(p.from)} ${String(p.noun)}`;
    };
    return render;
  }
};
