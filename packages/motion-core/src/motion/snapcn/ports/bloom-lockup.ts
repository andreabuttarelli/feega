import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'bloom-lockup',
  title: 'Bloom lockup',
  about: 'A wall of work blooms out from the logo, bends away through a lens and a flash, and the logo rises to its wordmark.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#faf9f6',
  fonts: ['Poppins', 'Geist Mono'],
  props: {
    wordmark: { type: 'string', title: 'Wordmark', default: 'snapcn', group: 'Content', maxLength: 60 },
    tagline: { type: 'string', title: 'Tagline', default: 'snapcn.dev', group: 'Content', maxLength: 80 },
    images: { type: 'string', title: 'Image URLs, comma separated (empty = tiles)', default: '', group: 'Content', maxLength: 2000 },
    wordmarkFont: { type: 'string', title: 'Wordmark font', format: PropFormat.Font, default: 'Poppins', group: 'Style' },
    taglineFont: { type: 'string', title: 'Tagline font', format: PropFormat.Font, default: 'Geist Mono', group: 'Style' },
    wordmarkWeight: { type: 'number', title: 'Wordmark weight', default: 600, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    wordmarkSize: { type: 'number', title: 'Wordmark size (stage px)', default: 112, minimum: 20, maximum: 300, step: 1, group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const BLOOM_SECONDS = 1.825;
    const LOCKUP_SECONDS = 2.063;
    const HOLD_SECONDS = 0.1;
    const BLOOM_CARDS = [
    [43.1, -65.8, 226.5, 221.1],
    [310.0, -65.8, 229.2, 347.9],
    [582.4, -65.8, 223.8, 172.6],
    [846.7, -65.8, 229.2, 366.7],
    [1116.3, -65.8, 226.5, 245.4],
    [1653.0, -65.8, 226.5, 226.5],
    [1386.0, 39.3, 226.5, 391.0],
    [579.7, 147.2, 226.5, 391.0],
    [43.1, 195.7, 226.5, 391.0],
    [1653.0, 201.1, 226.5, 142.9],
    [310.0, 322.5, 229.2, 151.0],
    [1653.0, 384.5, 226.5, 124.0],
    [1383.3, 473.5, 229.2, 207.6],
    [310.0, 514.0, 229.2, 199.6],
    [1653.0, 551.7, 229.2, 124.0],
    [579.7, 592.2, 229.2, 453.0],
    [40.4, 629.9, 229.2, 391.0],
    [1113.6, 651.5, 229.2, 391.0],
    [1653.0, 716.2, 229.2, 159.1],
    [1383.3, 721.6, 229.2, 275.1],
    [849.4, 729.7, 223.8, 110.6],
    [310.0, 754.0, 229.2, 183.4],
    [849.4, 880.7, 223.8, 264.3],
    [1653.0, 915.7, 226.5, 229.2],
    [310.0, 977.8, 229.2, 167.2],
    [1383.3, 1037.1, 229.2, 107.9],
    [849.4, 352.2, 223.8, 334.4],
    [1116.3, 220.0, 226.5, 391.0],
    ];
    const BLOOM_DELAY = [
    0.669, 0.466, 0.366, 0.271, 0.406, 0.68, 0.388, 0.217, 0.548, 0.58, 0.348,
    0.55, 0.34, 0.34, 0.552, 0.249, 0.577, 0.262, 0.583, 0.411, 0.166, 0.386,
    0.317, 0.58, 0.567, 0.478, 0.071, 0.196,
    ];
    const BLOOM_FADE = [
    0.239, 0.409, 0.395, 0.334, 0.389, 0.298, 0.42, 0.414, 0.394, 0.42, 0.401,
    0.37, 0.42, 0.412, 0.42, 0.42, 0.385, 0.42, 0.42, 0.384, 0.203, 0.42, 0.391,
    0.42, 0.353, 0.42, 0.124, 0.42,
    ];
    const BLOOM_ZOOM = [
    0.9847, 0.9848, 0.9848, 0.9849, 0.9849, 0.9849, 0.985, 0.985, 0.9851, 0.9851,
    0.9852, 0.9852, 0.9852, 0.9853, 0.9853, 0.9854, 0.9854, 0.9854, 0.9855,
    0.9855, 0.9856, 0.9856, 0.9856, 0.9857, 0.9857, 0.9858, 0.9858, 0.9858, 0.986,
    0.9863, 0.9865, 0.9867, 0.9868, 0.987, 0.9874, 0.9877, 0.9879, 0.9883, 0.9887,
    0.9892, 0.9897, 0.9903, 0.9909, 0.9916, 0.9922, 0.993, 0.9938, 0.9943, 0.9953,
    0.9962, 0.9972, 0.9981, 0.9993, 1.0003, 1.0014, 1.0016,
    ];
    const LOCKUP_CARDS = [
    [103.7, -61.8, 302.0, 231.9],
    [457.0, -61.8, 302.0, 172.6],
    [813.0, -61.8, 299.3, 83.6],
    [1160.8, -61.8, 304.7, 563.6],
    [1516.8, -61.8, 302.0, 196.9],
    [1870.0, 56.9, 110.6, 358.7],
    [810.3, 75.7, 302.0, 649.9],
    [457.0, 164.7, 302.0, 275.1],
    [-68.8, 175.5, 121.3, 512.4],
    [1516.8, 186.3, 302.0, 364.0],
    [106.4, 221.4, 299.3, 515.1],
    [1870.0, 472.2, 110.6, 186.1],
    [457.0, 488.3, 302.0, 288.5],
    [1158.1, 545.0, 304.7, 596.0],
    [1514.1, 604.3, 304.7, 229.2],
    [1870.0, 712.2, 110.6, 164.5],
    [-68.8, 741.8, 121.3, 399.1],
    [103.7, 790.4, 302.0, 199.6],
    [807.6, 820.0, 304.7, 218.4],
    [454.3, 828.1, 304.7, 312.8],
    [1516.8, 884.7, 463.8, 256.2],
    [106.4, 1041.1, 299.3, 99.8],
    ];
    const LENS_FROM = 0.02;
    const LENS_RADIUS = 960;
    const LENS = [
    0.01313, 0.01484, 0.01758, 0.02186, 0.02722, 0.03385, 0.04192, 0.05143,
    0.06274, 0.07689, 0.09468, 0.11714, 0.14713, 0.19098, 0.25382, 0.34701,
    0.5287, 1.56386,
    ];
    const LENS_ZOOM = [
    1.0, 0.99627, 0.9925, 0.98863, 0.98457, 0.98025, 0.97571, 0.97095, 0.96603,
    0.96092, 0.95548, 0.94957, 0.94291, 0.93499, 0.92518, 0.91473, 0.89903,
    0.85653,
    ];
    const LENS_FLASH = [
    [1.424, 1.491, 1.47, 1.67],
    [1.403, 1.45, 1.437, 1.79],
    ];
    const BEHIND_LOGO = { bloom: 26, lockup: 6 };
    const CARD_HALO = { bloom: 12, lockup: 16 };
    const LOGO_FADE = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0.089, 0.204, 0.379, 0.541, 0.737, 0.834, 0.91,
    0.971, 0.981, 0.997, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    ];
    const LOGO_SIZE_BLOOM = [
    143.9, 144.3, 145, 145.6, 146.1, 146.8, 147.4, 148, 148.8, 149.4, 150, 150.6,
    151.1, 151.6, 152.2, 152.8, 153.3, 153.5, 154, 154.9, 156, 156.8, 157.3,
    157.6, 157.7, 157.8, 157.8, 157.9, 157.9, 158, 158, 158, 158, 158, 158, 158,
    158.1, 158.1, 158.2, 158.2, 158.3, 158.4, 158.4, 158.3, 158.3, 158.4, 158.4,
    158.5, 158.9, 159.2, 159.6, 160, 160.4, 160.7, 160.8, 160.8,
    ];
    const LOGO_SIZE_LOCKUP = [
    210.2, 210, 210, 210, 210, 210, 210.1, 210.1, 210, 210, 210, 210, 210.1,
    210.2, 210.4, 210.5, 210.5, 210.6, 210.6, 210.6, 210.6, 210.6, 210.6, 210.6,
    210.7, 210.7, 210.8, 210.8, 210.8, 210.9, 210.9, 211, 211, 211.1, 211.1,
    211.2, 211.3, 211.3, 211.4, 211.4, 211.4, 211.5, 211.6, 211.7, 211.8, 212,
    212.1, 212.3, 212.5, 212.7, 212.9, 213, 213.1, 213.3, 213.4, 213.5, 213.5,
    213.6, 213.6, 213.6, 213.6, 213.6, 213.6,
    ];
    const LOGO_Y = [
    540.4, 533.2, 516.9, 502.5, 492.3, 485.4, 473.4, 459.9, 452.1, 442, 437.3,
    432.8, 428, 422.9, 418.6, 415.4, 414, 412.3, 411.6, 410.7, 409.9, 409.4,
    409.2, 408.8, 408.6, 408.5, 408.4, 408.4, 408.3, 408.3, 408.3, 408.2, 408.2,
    408.2, 408.2, 408.1, 408.1, 408, 407.9, 407.8, 407.8, 407.8, 407.7, 407.5,
    407.4, 407.3, 407.3, 407.3, 407.1, 407, 406.9, 406.9, 406.9, 406.9, 406.8,
    406.8, 406.7, 406.7, 406.7, 406.7, 406.7, 406.7, 406.7,
    ];
    const WORDMARK_Y = 653.6;
    const TAGLINE_Y = 715.7;
    const WORDMARK_FADE = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.006, 0.023, 0.161,
    0.291, 0.432, 0.588, 0.676, 0.734, 0.789, 0.821, 0.85, 0.878, 0.898, 0.928,
    0.935, 0.941, 0.946, 0.953, 0.969, 0.973, 0.975, 0.975, 0.976, 0.977, 0.977,
    0.977, 0.979, 0.98, 0.982, 0.983, 0.984, 0.986, 0.987, 0.988, 0.989, 0.99,
    0.992, 0.993, 0.994, 0.995, 0.996, 0.998, 0.999, 1,
    ];
    const WORDMARK_RISE = [
    17.5, 17.5, 17.5, 17.5, 17.5, 17.5, 17.5, 17.5, 17.5, 17.5, 17.5, 17.5, 17.5,
    17.5, 17.5, 17.5, 17.5, 17.5, 17.5, 17.5, 17.5, 17.5, 17.5, 15.9, 11.7, 9,
    7.4, 5.8, 4.7, 4, 3.1, 2.4, 1.8, 1.3, 0.7, 0.6, 0.6, 0.6, 0.1, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    const TAGLINE_FADE = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.001, 0.06, 0.169, 0.353, 0.474,
    0.596, 0.674, 0.791, 0.853, 0.911, 0.957, 0.975, 0.981, 0.982, 0.986, 0.988,
    0.996, 0.999, 0.999, 0.999, 1, 1, 1,
    ];
    const TAGLINE_RISE = [
    11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9,
    11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9,
    11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9, 11.9,
    11.9, 11.9, 11.9, 11.9, 11.9, 9.3, 5.9, 4.5, 2.2, 0.9, 0.2, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
    ];
    const SNAPCN_MARK = { fill: 0.56,
    width: 723,
    height: 632,
    shapes: [
    "M92.2 44.6C66.0 51.0 44.4 67.9 32.7 91.1C23.3 109.8 23.5 104.2 23.5 284.9C23.5 442.1 23.6 450.7 26.4 459.0C34.0 482.0 49.6 494.3 78.2 500.0C93.9 503.1 98.1 505.1 107.3 513.6C115.6 521.2 118.9 530.6 118.9 546.7C119.1 565.7 125.5 577.4 139.7 584.9L147.9 589.1L301.2 589.6C439.4 590.1 455.5 589.8 464.3 587.6C476.0 584.3 485.1 577.1 491.0 565.8L495.3 557.8L495.7 508.6C496.0 481.5 496.0 455.0 495.7 450.0L495.3 440.6L490.4 448.5C484.8 457.7 474.6 466.5 463.8 471.3L456.1 474.9L329.4 475.4C236.9 475.7 200.3 475.4 194.0 474.1C174.0 469.8 153.7 455.2 143.2 437.5C133.0 420.3 132.9 417.5 133.3 308.3L133.8 210.5L137.5 201.4C144.4 184.0 160.5 168.5 179.8 160.9L188.6 157.3L318.4 156.8C445.0 156.5 448.5 156.5 458.5 159.6C471.0 163.5 481.8 171.2 489.5 181.8L495.3 190.0L495.7 137.7C496.2 80.3 495.3 72.3 487.0 60.4C482.3 53.5 471.6 46.2 463.2 43.8C459.7 42.9 391.7 42.2 279.3 42.4C134.9 42.6 99.2 42.9 92.2 44.6ZM594.6 173.2C543.5 203.9 501.0 229.7 500.4 230.7C499.8 231.6 499.3 270.4 499.6 316.7L500.0 401.2L522.6 415.5C535.2 423.3 555.2 435.8 567.2 443.1C579.3 450.5 611.5 470.4 638.7 487.3C666.0 504.2 689.8 517.9 691.5 517.9C693.2 517.9 695.7 516.9 697.0 515.4C699.1 513.3 699.5 493.4 699.5 319.2C699.5 197.0 698.8 123.9 697.9 121.4C696.8 118.3 695.4 117.4 692.1 117.4C689.3 117.5 655.8 136.6 594.6 173.2Z",
    ],
    };    const p = view.props;
    const c = S.themeOf(String(p.mode));
    const STAGE_W = 1920;
    const STAGE_H = 1080;
    const RATE = 30;
    const MAP_W = 240;
    const MAP_H = 135;
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const images = String(p.images).split(/,(?=\s*(?:https?:|data:|\/))/).map((s) => s.trim()).filter(Boolean);
    const speed = Number(p.speed);
    const px = Math.max(view.width / STAGE_W, view.height / STAGE_H);
    const logo = SNAPCN_MARK;
    const pickImage = (i: number) => images[i % Math.max(1, images.length)] ?? '';

    const sample = (table: readonly number[], seconds: number) => {
      const x = Math.max(0, Math.min(seconds * RATE, table.length - 1));
      const i = Math.floor(x);
      const a = table[i] ?? 0;
      return a + ((table[i + 1] ?? a) - a) * (x - i);
    };
    const cardFade = (i: number, t: number) => {
      const x = Math.max(0, Math.min(1, (t - (BLOOM_DELAY[i] ?? 0)) / (BLOOM_FADE[i] ?? 0.2)));
      return x * x * (3 - 2 * x);
    };
    const lensFactor = (q: number, r: number) => 1 / Math.sqrt(1 + q * r * r);
    const lensSplit = (q: number, rMax: number) => {
      const worst = (k: number) => {
        let m = 0;
        for (let j = 1; j <= 64; j++) {
          const r = (rMax * j) / 64;
          m = Math.max(m, r * Math.abs(lensFactor(q, r) / k - 1));
        }
        return m;
      };
      let lo = lensFactor(q, rMax);
      let hi = 1;
      for (let it = 0; it < 60; it++) {
        const a = lo + (hi - lo) / 3;
        const b = hi - (hi - lo) / 3;
        if (worst(a) < worst(b)) {
          hi = b;
        } else {
          lo = a;
        }
      }
      return (lo + hi) / 2;
    };

    const lensMaps = () => {
      const cx = STAGE_W / 2;
      const cy = STAGE_H / 2;
      const rMax = Math.hypot(cx, cy) / LENS_RADIUS;
      const canvas = document.createElement('canvas');
      canvas.width = MAP_W;
      canvas.height = MAP_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return [];
      }
      return LENS.map((q) => {
        const split = lensSplit(q, rMax);
        const field: number[] = [];
        let peak = 1e-3;
        for (let j = 0; j < MAP_H; j++) {
          for (let i = 0; i < MAP_W; i++) {
            const dx = ((i + 0.5) / MAP_W) * STAGE_W - cx;
            const dy = ((j + 0.5) / MAP_H) * STAGE_H - cy;
            const g = lensFactor(q, Math.hypot(dx, dy) / LENS_RADIUS) / split - 1;
            field.push(dx * g, dy * g);
            peak = Math.max(peak, Math.abs(dx * g), Math.abs(dy * g));
          }
        }
        const scale = peak * 2.02;
        const img = ctx.createImageData(MAP_W, MAP_H);
        for (let k = 0; k < MAP_W * MAP_H; k++) {
          img.data[k * 4] = Math.round(255 * (0.5 + (field[2 * k] ?? 0) / scale));
          img.data[k * 4 + 1] = Math.round(255 * (0.5 + (field[2 * k + 1] ?? 0) / scale));
          img.data[k * 4 + 2] = 128;
          img.data[k * 4 + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        const href = canvas.toDataURL('image/png');
        new Image().src = href;
        return { href, scale, split };
      });
    };
    const maps = lensMaps();

    const card = (rect: readonly number[], src: string, halo: number) => {
      const [x = 0, y = 0, w = 0, hh = 0] = rect;
      const img = src ? S.h('img', { src, style: { width: '100%', height: '100%', maxWidth: 'none', objectFit: 'cover', display: 'block' } }) : null;
      return S.h('div', { style: { position: 'absolute', left: x, top: y, width: w, height: hh, overflow: 'hidden', background: String(c.card), boxShadow: `0 0 ${halo}px ${halo * 0.6}px rgba(0,0,0,0.05)` } }, img) as HTMLElement;
    };
    const bloomCards = BLOOM_CARDS.map((rect, i) => (i === BEHIND_LOGO.bloom ? null : card(rect, pickImage(i), CARD_HALO.bloom)));
    const lockupCards = LOCKUP_CARDS.map((rect, i) => (i === BEHIND_LOGO.lockup ? null : card(rect, pickImage(i + 7), CARD_HALO.lockup)));

    const board = S.fill({ display: 'block', transformOrigin: '50% 50%' }, bloomCards, lockupCards) as HTMLElement;
    const lensLayer = S.fill({ display: 'block' }, board) as HTMLElement;
    const filterHost = document.createElementNS(SVG_NS, 'svg');
    filterHost.setAttribute('width', '0');
    filterHost.setAttribute('height', '0');
    filterHost.setAttribute('style', 'position:absolute');

    const mark = S.h('g', null, logo.shapes.map((d) => S.h('path', { d, fill: String(c.card), fillRule: 'evenodd' })));
    const markSvg = S.h('svg', { style: { position: 'absolute', top: 0, left: 0 } }, mark) as SVGSVGElement;
    const tile = S.h('div', { style: { position: 'absolute', background: String(c.foreground) } }, markSvg) as HTMLElement;

    const lineOf = (text: Element) => {
      const copies = [0, 1].map(() => S.h('g', { style: { mixBlendMode: 'plus-lighter' } }, text.cloneNode(true)) as SVGGElement);
      const group = S.h('g', { style: { isolation: 'isolate' } }, copies) as SVGGElement;
      const place = (y: number, opacity: number) => {
        group.style.display = opacity <= 0 ? 'none' : '';
        group.setAttribute('opacity', String(opacity));
        const row = Math.floor(y * px);
        const f = y * px - row;
        [1 - f, f].forEach((w, k) => {
          copies[k].setAttribute('transform', `translate(${STAGE_W / 2} ${(row + k + 1e-3) / px})`);
          copies[k].style.opacity = String(w);
        });
      };
      return { group, place };
    };
    const wordmark = lineOf(S.h('text', { textAnchor: 'middle', fill: String(c.foreground), style: { fontFamily: S.pick(p.wordmarkFont, 'Poppins'), fontWeight: Number(p.wordmarkWeight), fontSize: Number(p.wordmarkSize), letterSpacing: '-0.02em', textRendering: 'geometricPrecision' } }, String(p.wordmark)));
    const tagline = lineOf(S.h('text', { textAnchor: 'middle', fill: String(c.mutedForeground), style: { fontFamily: S.pick(p.taglineFont, 'Geist Mono'), fontSize: 40, textRendering: 'geometricPrecision' } }, String(p.tagline)));
    const type = S.h('svg', { viewBox: `0 0 ${STAGE_W} ${STAGE_H}`, width: '100%', height: '100%', style: { position: 'absolute', top: 0, left: 0 } }, wordmark.group, tagline.group) as SVGSVGElement;

    view.root.replaceChildren(S.fill({ display: 'block', background: String(c.background), overflow: 'hidden' }, filterHost, lensLayer, tile, type));

    const setFilter = (map: { href: string; scale: number } | null, flash: readonly number[] | undefined) => {
      if (!map) {
        filterHost.replaceChildren();
        lensLayer.style.filter = '';
        return;
      }
      const lit = flash
        ? [
            S.h('feComponentTransfer', { in: 'bent', result: 'lit' }, ['feFuncR', 'feFuncG', 'feFuncB'].map((tag, k) => S.h(tag, { type: 'linear', slope: flash[k] }))),
            S.h('feGaussianBlur', { in: 'lit', stdDeviation: flash[3] })
          ]
        : [];
      const image = document.createElementNS(SVG_NS, 'feImage');
      [['href', map.href], ['x', '0'], ['y', '0'], ['width', String(STAGE_W)], ['height', String(STAGE_H)], ['preserveAspectRatio', 'none'], ['result', 'map']].forEach(([k, v]) => image.setAttribute(k, v));
      const filter = S.h('filter', { id: 'bloom-lens', x: 0, y: 0, width: STAGE_W, height: STAGE_H, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', colorInterpolationFilters: 'sRGB' }, image, S.h('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: map.scale, xChannelSelector: 'R', yChannelSelector: 'G', result: 'bent' }), lit);
      filterHost.replaceChildren(filter);
      lensLayer.style.filter = 'url(#bloom-lens)';
    };

    const show = (el: HTMLElement | null, opacity: number) => {
      if (!el) {
        return;
      }
      el.style.display = opacity <= 0 ? 'none' : '';
      el.style.opacity = String(opacity);
    };

    return (frame) => {
      const t = (frame * speed) / view.fps;
      const bloom = t < BLOOM_SECONDS;
      const b = t - BLOOM_SECONDS;
      const size = bloom ? sample(LOGO_SIZE_BLOOM, t) : sample(LOGO_SIZE_LOCKUP, b);
      const y = bloom ? STAGE_H / 2 : sample(LOGO_Y, b);
      const zoom = bloom ? sample(BLOOM_ZOOM, t) : 1 + 0.00009 * (0.55 - b) * 60;
      const lift = bloom ? 0 : -3.5 * (b - 0.4);
      const row = bloom ? -1 : Math.round((b - LENS_FROM) * RATE);
      const gone = row >= LENS.length;
      const map = row >= 0 && !gone ? (maps[row] ?? null) : null;
      const flash = bloom ? undefined : LENS_FLASH[row - (LENS.length - 2)];

      setFilter(map, flash);
      board.style.transform = `translateY(${lift}px) scale(${zoom * (map ? (LENS_ZOOM[row] ?? 1) / map.split : 1)})`;
      bloomCards.forEach((el, i) => show(el, bloom ? cardFade(i, t) : 0));
      lockupCards.forEach((el) => show(el, !bloom && !gone ? 1 : 0));

      const logoScale = (size * logo.fill) / Math.max(logo.width, logo.height);
      Object.assign(tile.style, { left: `${STAGE_W / 2 - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px`, borderRadius: `${size * 0.235}px`, opacity: String(bloom ? sample(LOGO_FADE, t) : 1), boxShadow: `0 ${size * 0.1}px ${size * 0.34}px rgba(0,0,0,0.22)` });
      markSvg.setAttribute('viewBox', `0 0 ${size} ${size}`);
      markSvg.setAttribute('width', String(size));
      markSvg.setAttribute('height', String(size));
      mark.setAttribute('transform', `translate(${size / 2} ${size / 2}) scale(${logoScale}) translate(${-logo.width / 2} ${-logo.height / 2})`);

      type.style.display = bloom ? 'none' : '';
      wordmark.place(WORDMARK_Y + sample(WORDMARK_RISE, b), sample(WORDMARK_FADE, b));
      tagline.place(TAGLINE_Y + sample(TAGLINE_RISE, b), sample(TAGLINE_FADE, b));
    };
  }
};
