import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'portal-intro',
  title: 'Portal intro',
  about: 'A line of type opens a chip that grows into a full-frame portal, then a title and brand mark land over it.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 108,
  background: '#faf9f6',
  fonts: ['Geist'],
  props: {
    lead: { type: 'string', title: 'Lead words', default: 'your launch video', group: 'Content', maxLength: 60 },
    trail: { type: 'string', title: 'Trailing words', default: 'in code', group: 'Content', maxLength: 60 },
    title: { type: 'string', title: 'Title', default: 'Introducing', group: 'Content', maxLength: 40 },
    brand: { type: 'string', title: 'Brand', default: 'snapcn', group: 'Content', maxLength: 40 },
    image: { type: 'string', title: 'Portal image URL (empty = gradient)', default: '', group: 'Content', maxLength: 2000 },
    chipImage: { type: 'string', title: 'Chip image URL (empty = portal image)', default: '', group: 'Content', maxLength: 2000 },
    logoSrc: { type: 'string', title: 'Logo image URL (empty = mark)', default: '', group: 'Content', maxLength: 2000 },
    overlay: { type: 'string', title: 'Title colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    color: { type: 'string', title: 'Line colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const FACE = 'Portal Intro Geist';
    let redraw = () => {};
    if (typeof FontFace !== 'undefined' && ![...document.fonts].some((f) => f.family === FACE)) {
      const loaded = new FontFace(FACE, 'url(https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFU.woff2) format("woff2")', { weight: '100 900' });
      document.fonts.add(loaded);
      loaded.load().then(() => redraw()).catch(() => undefined);
    }
    const face = S.pick(p.fontFamily, `"${FACE}", Geist, ui-sans-serif, system-ui, sans-serif`);
    type Table = { from: number; v: number[] };
    const REF_W = 714;
    const REF_H = 402;
    const LEAD = 1;
    const PIVOT_X = 345.17;
    const PIVOT_Y = 198.93;
    const CENTRE_A = 357;
    const CENTRE_B = 360.27;
    const BASELINE = 206.46;
    const LINE_SIZE = 26.834;
    const LINE_WEIGHT = 450;
    const LINE_TRACKING = -0.01;
    const STAGGER = 6;
    const CHIP_RADIUS = 4.4;
    const FIRST_LINE_TO = 22;
    const SECOND_LINE_TO = 46;
    const OPEN_AT = 49;
    const TITLE_FROM = 48;
    const TITLE_TO = 70;
    const MARK_FROM = 71;
    const BRAND_FROM = 73;
    const BRAND_STAGGER = 2;
    const TITLE_SIZE = 30.29;
    const TITLE_WEIGHT = 500;
    const TITLE_TRACKING = -0.02;
    const TITLE_CENTRE = 357.415;
    const MARK_SIZE = 29.22;
    const BRAND_SIZE = 38.19;
    const BRAND_WEIGHT = 450;
    const BRAND_TRACKING = -0.03;
    const BRAND_GAP = 3.25;
    const BRAND_CENTRE = 356.86;
    const BRAND_DROP = 10.74;
    const MARK_REST = 199;
    const MARK_SETTLE = 0.88;
    const BLEED = 1.5;
    const SCALE: Table = { from: -1, v: [0.948789, 0.948789, 0.948789, 0.949727, 0.9491, 0.94994, 0.950745, 0.950887, 0.95062, 0.951965, 0.952448, 0.953167, 0.95334, 0.954234, 0.955356, 0.956136, 0.957932, 0.959057, 0.961321, 0.963993, 0.96696, 0.970379, 0.97696, 0.985827, 1.00001, 1.01553, 1.02495, 1.03178, 1.0374, 1.04274, 1.04826, 1.05222, 1.05734, 1.06323, 1.06908, 1.07466, 1.08109, 1.08821, 1.09531, 1.10385, 1.1126, 1.12312, 1.13474, 1.14857, 1.16463, 1.18435, 1.21107, 1.26697] };
    const PAN: Table = { from: -1, v: [-57, -44.2, -34.069, -25.946, -20.352, -15.946, -12.41, -9.611, -7.358, -5.421, -3.863, -2.598, -1.655, -0.897, -0.338, 0.013, 0.226, 0.236, 0.249, 0.225, 0.19, 0.086, 0.055, -0.045] };
    const WORD_OPACITY: Table = { from: -1, v: [0, 0.15, 0.317, 0.457, 0.563, 0.642, 0.706, 0.754, 0.804, 0.812, 0.871, 0.888, 0.909, 0.933, 0.949, 0.964, 0.981, 0.996, 0.988, 0.993, 0.994, 0.999, 1, 1] };
    const WORD_RISE: Table = { from: -1, v: [4.58, 3.907, 3.314, 2.797, 2.348, 1.962, 1.632, 1.354, 1.12, 0.926, 0.764, 0.629, 0.516, 0.418, 0.333, 0.261, 0.2, 0.148, 0.104, 0.066, 0.034, 0.005, 0, 0] };
    const SLOT: Table = { from: 23, v: [60.732, 65.134, 67.143, 68.482, 69.546, 70.405, 71.05, 71.649, 72.167, 72.54, 72.803, 73.062, 73.292, 73.382, 73.481, 73.663, 74.218, 75.148, 76.582, 78.659, 81.609, 85.948, 92.559, 109.382] };
    const CHIP_W: Table = { from: 23, v: [44.508, 45.945, 46.76, 47.144, 47.798, 47.894, 48.001, 48.454, 48.466, 48.546, 48.653, 48.693, 48.885, 49.032, 49.904, 51.058, 52.22, 54.09, 56.437, 59.433, 63.447, 69.108, 77.2, 96.579] };
    const CHIP_H: Table = { from: 23, v: [25.253, 26.036, 26.521, 26.778, 26.907, 27.012, 27.039, 27.174, 27.431, 27.515, 27.597, 27.85, 28.043, 28.097, 28.312, 28.967, 29.719, 30.467, 31.741, 33.415, 35.677, 38.81, 43.202, 54.168] };
    const CHIP_DX: Table = { from: 23, v: [-0.662, -1.12, -1.266, -1.491, -1.497, -1.626, -1.705, -1.681, -1.744, -1.766, -1.773, -1.828, -1.882, -1.924, -1.888, -1.869, -1.95, -1.931, -2.032, -2.236, -2.339, -2.701, -3.151, -4.166] };
    const CHIP_DY: Table = { from: 23, v: [0.241, 0.197, 0.166, 0.154, 0.169, 0.179, 0.195, 0.171, 0.192, 0.177, 0.155, 0.17, 0.16, 0.091, 0.078, 0.107, 0.088, 0.081, 0.074, 0.113, 0.045, 0.09, 0.022, 0.055] };
    const CHIP_ZOOM: Table = { from: 23, v: [1.3053, 1.2221, 1.1553, 1.1025, 1.062, 1.0324, 1.0126, 1.002, 1, 1.0065, 1.0215, 1.045, 1.0777, 1.12, 1.1728, 1.2372, 1.3146, 1.4068, 1.5158, 1.6442, 1.7952, 1.9726, 2.1809, 2.4258] };
    const BG_SCALE: Table = { from: 47, v: [0.6285, 0.7741, 0.8335, 0.8644, 0.8844, 0.9068, 0.9271, 0.9434, 0.9558, 0.9633, 0.9687, 0.9745, 0.9804, 0.9861, 0.993, 0.9972, 1.0004, 1.0028, 1.0046, 1.0061, 1.0076, 1.0073, 1.0072, 1.0069, 1.0065, 1.0053, 1.0045, 1.0037, 1.0023, 1.0019, 1.0018, 1.0016, 1.0011, 1.001, 1.0009, 1.0006, 1.0004, 1.0001, 1, 1] };
    const BG_X: Table = { from: 47, v: [18, 13.45, 9.15, 7.91, 6.79, 4.8494, 3.6476, 3.2565, 1.8995, 1.3861, 0.971, 1.751, 1.4813, 1.494, 0.9013, 0.7599, 0.5335, 0.4651, 0.3116, 0.215, 0.12, 0.129, 0.134, 0.143, 0.143, 0.095, 0.092, 0.061, 0.03, 0.028, 0.033, 0.03, 0.039, 0.038, 0.032, 0.024, 0.008, -0.001, -0.002, -0] };
    const BG_Y: Table = { from: 47, v: [-0.68, -0.7, -0.14, 0.34, 0.36, 0.4344, 0.4116, 0.3287, 0.1941, -0.0261, 0.0106, -0.1763, -0.3804, -0.3697, -0.3417, -0.3645, -0.2931, -0.2826, -0.2109, -0.209, -0.211, -0.19, -0.181, -0.158, -0.115, -0.055, -0.031, 0.01, 0.054, 0.071, 0.065, 0.069, 0.052, 0.044, 0.036, 0.024, 0.025, 0.015, 0.005, -0] };
    const BG_BLUR: Table = { from: 47, v: [14.91, 15.45, 14.33, 10.26, 6.93, 11.7455, 9.8469, 7.6187, 4.426, 3.187, 1.9011, 1.3233, 0.6, 0.3, 0] };
    const TITLE_Y: Table = { from: 48, v: [212.158, 212.105, 212.085, 212.085, 212.085, 212.085, 212.085, 212.085, 212.085, 212.085, 212.043, 211.919, 211.741, 211.499, 211.188, 210.801, 210.33, 209.769, 209.094, 208.213, 207.02, 205.165, 201.343] };
    const LETTER_RISE: Table = { from: 0, v: [2.104, 1.661, 1.283, 0.964, 0.7, 0.486, 0.317, 0.187, 0.091, 0.026, 0] };
    const LETTER_OPACITY: Table = { from: 0, v: [0.372, 0.53, 0.64, 0.722, 0.791, 0.851, 0.892, 0.927, 0.953, 0.97, 0.981, 0.988, 0.995, 0.998, 0.998, 0.995, 0.997, 1, 1, 1, 1, 0.999, 0.995] };
    const MARK_Y: Table = { from: 71, v: [204.337, 203.041, 202.271, 201.782, 201.431, 201.121, 200.837, 200.584, 200.368, 200.191, 200.046, 199.925, 199.819, 199.717, 199.612, 199.494] };
    const MARK_OPACITY: Table = { from: 71, v: [0.642, 0.845, 0.916, 0.949, 0.975, 0.987, 0.998, 0.998, 0.997, 0.997, 1] };
    const BRAND_RISE: Table = { from: 0, v: [3.059, 2.205, 1.602, 1.188, 0.904, 0.693, 0.528, 0.388, 0.255, 0.13, 0.02, 0] };
    const OPENING: Record<number, number[]> = { 47: [108.9, 50.8, 637.35, 347.11, 13.1], 48: [38.69, 14.06, 698.6, 383.87, 15.9] };
    const MARK_PATH = 'M589 3805 c-167 -41 -305 -149 -380 -297 -60 -120 -59 -84 -59 -1239 0 -1004 1 -1059 19 -1112 48 -147 148 -226 331 -262 100 -20 127 -33 186 -87 53 -49 74 -109 74 -212 1 -121 42 -196 133 -244 l52 -27 980 -3 c883 -3 986 -1 1042 13 75 21 133 67 171 139 l27 51 3 315 c2 173 2 342 0 374 l-3 60 -31 -50 c-36 -59 -101 -115 -170 -146 l-49 -23 -810 -3 c-591 -2 -825 0 -865 8 -128 28 -258 121 -325 234 -65 110 -66 128 -63 826 l3 625 24 58 c44 111 147 210 270 259 l56 23 830 3 c809 2 831 2 895 -18 80 -25 149 -74 198 -142 l37 -52 3 334 c3 367 -3 418 -56 494 -30 44 -98 91 -152 106 -22 6 -457 10 -1175 9 -923 -1 -1151 -3 -1196 -14z M3800 2983 c-327 -196 -598 -361 -602 -367 -4 -6 -7 -254 -5 -550 l2 -540 145 -91 c80 -50 208 -130 285 -177 77 -47 283 -174 457 -282 174 -108 326 -196 337 -196 11 0 27 7 35 16 14 14 16 141 16 1254 0 781 -4 1248 -10 1264 -7 20 -16 26 -37 26 -18 -1 -232 -123 -623 -357z';

    const at = (tb: Table, x: number) => {
      const n = tb.v.length;
      const i = x - tb.from;
      if (i <= 0) {
        return tb.v[0];
      }
      if (i >= n - 1) {
        return tb.v[n - 1];
      }
      const i0 = Math.floor(i);
      return tb.v[i0] + (tb.v[i0 + 1] - tb.v[i0]) * (i - i0);
    };

    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    const measure = (text: string, size: number, weight: number, tracking: number) => {
      ctx.font = `${weight} ${size}px ${face}`;
      ctx.letterSpacing = `${tracking * size}px`;
      const pre = [...Array(text.length + 1).keys()].map((i) => ctx.measureText(text.slice(0, i)).width);
      const m = ctx.measureText('Hg');
      return { pre, asc: m.fontBoundingBoxAscent / size, desc: m.fontBoundingBoxDescent / size };
    };
    type Metrics = ReturnType<typeof measure>;

    const leadWords = String(p.lead).split(/\s+/).filter(Boolean);
    const trailWords = String(p.trail).split(/\s+/).filter(Boolean);
    const title = String(p.title);
    const brand = String(p.brand);
    const overlay = S.pick(p.overlay, '#ffffff');
    const ink = S.pick(p.color, String(t.foreground));
    const image = String(p.image ?? '');
    const chipImage = String(p.chipImage ?? '') || image;
    const logoSrc = String(p.logoSrc ?? '');
    const speed = Number(p.speed);

    const lineOf = (words: string[]) => {
      const text = words.join(' ');
      const m = measure(`${text} `, LINE_SIZE, LINE_WEIGHT, LINE_TRACKING);
      const starts: number[] = [];
      let i = 0;
      words.forEach((w) => {
        starts.push(m.pre[i] ?? 0);
        i += w.length + 1;
      });
      return { starts, width: m.pre[text.length] ?? 0, withSpace: m.pre[text.length + 1] ?? 0, asc: m.asc, desc: m.desc };
    };

    const picture = (src: string, style: Record<string, string | number>) => (src ? S.h('img', { src, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover', ...style } }) : S.h('div', { style: { width: '100%', height: '100%', background: `linear-gradient(135deg, ${t.primary}, ${S.mixOklch(String(t.primary), String(t.foreground), 0.6)})`, ...style } }));

    type G = { text: string; x: number; baseline: number; size: number; scale?: number; weight: number; tracking: number; asc: number; desc: number; color: string; opacity?: number; grid?: boolean };
    const glyphs = (g: G): Element | null => {
      const opacity = g.opacity ?? 1;
      const scale = g.scale ?? 1;
      const rise = g.size * (g.asc + (1 - g.asc - g.desc) / 2);
      if (opacity <= 0) {
        return null;
      }
      const type = { position: 'absolute', width: 'max-content', fontSize: g.size, lineHeight: 1, fontWeight: g.weight, letterSpacing: `${g.tracking}em`, whiteSpace: 'pre', color: g.color };
      if (g.grid && scale === 1) {
        const yd = g.baseline - rise;
        const lo = Math.floor(yd);
        const f = yd - lo;
        const copy = (top: number, o: number) => S.h('div', { style: { ...type, left: g.x, top, opacity: o, mixBlendMode: 'plus-lighter' } }, g.text);
        return S.h('div', { style: { position: 'absolute', inset: 0, isolation: 'isolate', opacity } }, copy(lo, 1 - f), f > 0.001 ? copy(lo + 1, f) : null);
      }
      return S.h('div', { style: { ...type, left: g.x, top: g.baseline - rise, transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: `0 ${rise}px`, opacity } }, g.text);
    };

    const box = (b: { l: number; t: number; w: number; h: number; r: number }, ...children: (Element | null)[]) => S.h('div', { style: { position: 'absolute', left: b.l, top: b.t, width: b.w, height: b.h, borderRadius: b.r, overflow: 'hidden' } }, ...children);

    const titleNodes = (m: Metrics, r: number) => {
      const x0 = TITLE_CENTRE - (m.pre[title.length] ?? 0) / 2;
      const base = at(TITLE_Y, r);
      return [...title].map((c, i) => {
        const kk = r - TITLE_FROM - i;
        return kk < 0 || c === ' ' ? null : glyphs({ text: c, x: x0 + m.pre[i], baseline: base + at(LETTER_RISE, kk), size: TITLE_SIZE, weight: TITLE_WEIGHT, tracking: TITLE_TRACKING, asc: m.asc, desc: m.desc, color: overlay, opacity: at(LETTER_OPACITY, kk), grid: true });
      });
    };

    const brandNodes = (m: Metrics, r: number) => {
      const last = MARK_Y.from + MARK_Y.v.length - 1;
      const y = r <= last ? at(MARK_Y, r) : MARK_REST + (at(MARK_Y, last) - MARK_REST) * MARK_SETTLE ** (r - last);
      const left = BRAND_CENTRE - (MARK_SIZE + BRAND_GAP + (m.pre[brand.length] ?? 0)) / 2;
      const textAt = left + MARK_SIZE + BRAND_GAP;
      const logo = logoSrc
        ? S.h('img', { src: logoSrc, alt: '', style: { width: '100%', height: '100%', objectFit: 'contain' } })
        : S.h('svg', { viewBox: '0 0 464 409', width: '100%', height: '100%', fill: 'currentColor' }, S.h('g', { transform: 'translate(0,409) scale(0.1,-0.1)' }, S.h('path', { d: MARK_PATH })));
      const mark = S.h('div', { style: { position: 'absolute', left, top: 0, transform: `translateY(${y - MARK_SIZE / 2}px)`, width: MARK_SIZE, height: MARK_SIZE, color: overlay, opacity: at(MARK_OPACITY, r), display: 'flex', alignItems: 'center', justifyContent: 'center' } }, logo);
      const letters = [...brand].map((c, i) => {
        const kk = r - BRAND_FROM - BRAND_STAGGER * i;
        return kk < 0 || c === ' ' ? null : glyphs({ text: c, x: textAt + m.pre[i], baseline: y + BRAND_DROP + at(BRAND_RISE, kk), size: BRAND_SIZE, weight: BRAND_WEIGHT, tracking: BRAND_TRACKING, asc: m.asc, desc: m.desc, color: overlay, grid: true });
      });
      return [mark, ...letters];
    };

    const k = Math.max(view.width / REF_W, view.height / REF_H);
    const stage = S.h('div', { style: { position: 'absolute', width: REF_W, height: REF_H, left: (view.width - REF_W * k) / 2, top: (view.height - REF_H * k) / 2, transform: `scale(${k})`, transformOrigin: 'top left', background: t.background, overflow: 'hidden', fontFamily: face, textRendering: 'geometricPrecision' } }) as HTMLElement;
    view.root.replaceChildren(S.fill({ background: 'transparent', overflow: 'hidden' }, stage));

    const render = (frame: number) => {
      redraw = () => render(frame);
      const r = frame * speed - LEAD;
      const lead = lineOf(leadWords);
      const trail = lineOf(trailWords);
      const s = at(SCALE, Math.min(r, SECOND_LINE_TO));
      const toX = (x: number) => PIVOT_X + s * (x - PIVOT_X);
      const toY = (y: number) => PIVOT_Y + s * (y - PIVOT_Y);
      const line = { size: LINE_SIZE, scale: s, weight: LINE_WEIGHT, tracking: LINE_TRACKING, color: ink };
      const nodes: (Element | null)[] = [];
      if (r < FIRST_LINE_TO + 0.5) {
        const x0 = CENTRE_A - lead.withSpace / 2 + at(PAN, r);
        leadWords.forEach((w, i) => {
          const kk = r - STAGGER * i;
          if (kk < WORD_OPACITY.from) {
            return;
          }
          nodes.push(glyphs({ ...line, text: w, x: toX(x0 + lead.starts[i]), baseline: toY(BASELINE + at(WORD_RISE, kk)), asc: lead.asc, desc: lead.desc, opacity: at(WORD_OPACITY, kk) }));
        });
      }
      const layers: (Element | null)[] = [];
      if (r >= FIRST_LINE_TO + 0.5 && r < SECOND_LINE_TO + 0.5) {
        const slot = at(SLOT, r);
        const x0 = CENTRE_B - (lead.withSpace + slot + trail.width) / 2;
        const slotAt = x0 + lead.withSpace;
        const trailAt = slotAt + slot;
        leadWords.forEach((w, i) => nodes.push(glyphs({ ...line, text: w, x: toX(x0 + lead.starts[i]), baseline: toY(BASELINE), asc: lead.asc, desc: lead.desc })));
        trailWords.forEach((w, i) => nodes.push(glyphs({ ...line, text: w, x: toX(trailAt + trail.starts[i]), baseline: toY(BASELINE), asc: trail.asc, desc: trail.desc })));
        const cw = at(CHIP_W, r) * s;
        const ch = at(CHIP_H, r) * s;
        const cx = toX(slotAt + slot / 2 + at(CHIP_DX, r));
        const cy = toY(PIVOT_Y + at(CHIP_DY, r));
        layers.push(box({ l: cx - cw / 2, t: cy - ch / 2, w: cw, h: ch, r: CHIP_RADIUS * s }, picture(chipImage, { transform: `scale(${at(CHIP_ZOOM, r)})` })));
      }
      if (r >= SECOND_LINE_TO + 0.5) {
        const o = OPENING[Math.round(r)];
        const op = o && r < OPEN_AT - 0.5 ? { l: o[0], t: o[1], w: o[2] - o[0], h: o[3] - o[1], r: o[4] } : { l: 0, t: 0, w: REF_W, h: REF_H, r: 0 };
        const blur = at(BG_BLUR, r);
        const inner = S.h('div', { style: { position: 'absolute', left: -op.l - (REF_W * (BLEED - 1)) / 2, top: -op.t - (REF_H * (BLEED - 1)) / 2, width: REF_W * BLEED, height: REF_H * BLEED, transform: `translate(${at(BG_X, r)}px, ${at(BG_Y, r)}px) scale(${at(BG_SCALE, r)})`, filter: blur > 0.05 ? `blur(${blur}px)` : undefined } }, picture(image, {}));
        layers.push(box(op, inner));
      }
      const extra = [
        ...(r >= TITLE_FROM && r < TITLE_TO + 0.5 ? titleNodes(measure(title, TITLE_SIZE, TITLE_WEIGHT, TITLE_TRACKING), r) : []),
        ...(r >= MARK_FROM ? brandNodes(measure(brand, BRAND_SIZE, BRAND_WEIGHT, BRAND_TRACKING), r) : [])
      ];
      stage.replaceChildren(...[...layers, ...nodes, ...extra].filter((x): x is Element => x !== null));
    };
    return render;
  }
};
