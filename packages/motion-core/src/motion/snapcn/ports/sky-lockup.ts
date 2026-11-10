import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'sky-lockup',
  title: 'Sky lockup',
  about: 'A wordmark lockup over a sky photo: the logo tile flips, the name fades, and a tagline assembles around the mark.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#ffffff',
  fonts: ['Geist', 'Poppins'],
  props: {
    wordmark: { type: 'string', title: 'Wordmark', default: 'feega', group: 'Content', maxLength: 40 },
    before: { type: 'string', title: 'Words left of the mark', default: 'your videos', group: 'Content', maxLength: 120 },
    after: { type: 'string', title: 'Words right of the mark', default: 'on one canvas', group: 'Content', maxLength: 120 },
    sky: { type: 'string', title: 'Sky image', format: PropFormat.Asset, assetKind: 'image', default: null, group: 'Content', maxLength: 2000 },
    fontFamily: { type: 'string', title: 'Tagline font', format: PropFormat.Font, default: 'Geist', group: 'Style' },
    fontWeight: { type: 'number', title: 'Tagline weight', default: 500, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    fontSize: { type: 'number', title: 'Tagline size (1080p px)', default: 90.5, minimum: 10, maximum: 300, step: 0.5, group: 'Style' },
    wordmarkFont: { type: 'string', title: 'Wordmark font', format: PropFormat.Font, default: 'Poppins', group: 'Style' },
    wordmarkWeight: { type: 'number', title: 'Wordmark weight', default: 600, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    wordmarkSize: { type: 'number', title: 'Wordmark size (1080p px)', default: 105, minimum: 10, maximum: 300, step: 0.5, group: 'Style' },
    wordmarkTracking: { type: 'number', title: 'Wordmark tracking (em)', default: 0, minimum: -0.2, maximum: 0.5, step: 0.005, group: 'Style' },
    wordmarkGap: { type: 'number', title: 'Mark to wordmark gap', default: 20, minimum: 0, maximum: 200, step: 0.5, group: 'Style' },
    lockupColor: { type: 'string', title: 'Lockup colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const CUT = [ [0, 77], [27, 50], [30, 41], [46, 25], [57, 14], ];
    const LINE_ON = { first: [32, 36], second: [57, 61, 65], step: 4, };
    const LETTERS_ON = { from: 2, to: 6 };
    const LETTERS_OFF = { from: 24, to: 28 };
    const LINE_Y = 569.9;
    const LINE_PIVOT = 942.5;
    const LINE_CENTER = 941.5;
    const LOCKUP_CENTER = 964.5;
    const LOCKUP_MARK = 74.4;
    const LOCKUP_GAP = 20;
    const LOCKUP_Y = 577.9;
    const TYPE_SIZE = 90.5;
    const TYPE_TRACKING = -0.02;
    const WORD_GAP = 18.5;
    const LOCKUP_SIZE = 105;
    const TILE_SIZE = [ 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 100.3, 99.8, 96.5, 94.7, 94.5, 93.7, 92.3, 90.9, 90, 89.6, 89.3, 89.2, 89.2, 89.2, 89.2, 89.2, 89.2, 89.2, 89.3, 89.3, 89.3, 89.3, 89.3, 89.4, 89.5, 89.9, 90.9, 92.6, 93.7, 94.2, 94.3, 94.4, 94.5, 94.5, 94.6, 94.6, 94.7, 94.7, 94.8, 94.8, 94.7, 94.7, 94.7, 94.7, 94.7, 94.7, 94.7, 94.7, ];
    const TILE_RADIUS = 0.52;
    const TILE_STROKE = 1.5;
    const TILE_LINE = 0.55;
    const TILE_FADE = [0, 0, 0, 0.24, 0.88, 1];
    const SKY_ZOOM = { from: 0.00715, tau: 5.68 };
    const WIPE_LEAN = [ 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.035, 0.039, 0.06, 0.059, 0.082, 0.12, 0.162, 0.179, 0.194, 0.198, 0.209, 0.215, 0.224, 0.231, 0.228, 0.239, 0.238, 0.254, 0.249, 0.241, 0.24, 0.231, 0.229, 0.222, 0.223, 0.222, 0.225, 0.225, 0.226, 0.226, 0.227, 0.227, 0.227, 0.227, 0.227, 0.24, 0.241, 0.241, 0.241, 0.241, 0.241, 0.241, 0.241, 0.241, 0.241, 0.241, 0.241, 0.241, 0.241, 0.241, 0.241, 0.241, ];
    const WIPE_STOPS = [ -647.2, 0, -566.3, 0.015, -485.4, 0.045, -404.5, 0.084, -323.6, 0.141, -242.7, 0.22, -161.8, 0.312, -80.9, 0.42, 0, 0.537, 80.9, 0.654, 161.8, 0.757, 242.7, 0.847, 323.6, 0.913, 404.5, 0.963, 485.4, 0.986, 566.3, 0.999, 647.2, 1, ];
    const WIPE = [ 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2967.6, 2722.2, 2427.9, 2327.9, 2265.8, 2130.9, 1958.8, 1678.9, 1169, 657.2, 378.2, 205.5, 82, -11.1, -85, -145.5, -193.3, -232.9, -269.4, -293.5, -322.2, -337.5, -353.6, -358, -367.8, -368.4, -367.8, -368, -368, -367.5, -367.5, -367.3, -367.4, -367.2, -367.2, -367.2, -367.2, -367.2, -372.2, -372.5, -1131.2, -1131.2, -1131.2, -1131.2, -1131.2, -1131.2, -1131.2, -1131.2, -1131.2, -1131.2, -1131.2, -1131.2, -1131.2, -1131.2, -1131.2, ];
    const MARK_X = [ 881.04, 880.96, 880.96, 880.91, 880.96, 880.99, 880.99, 880.97, 880.98, 880.97, 880.95, 880.98, 880.97, 880.97, 880.96, 880.95, 880.95, 880.96, 881.05, 881.05, 881.17, 881.3, 881.83, 882.48, 883.14, 884.45, 886.15, 888.68, 891.84, 896.58, 902.18, 920.66, 939.13, 949.21, 955.76, 959.13, 961.43, 962.95, 964.13, 964.72, 965.29, 965.64, 965.75, 965.81, 965.83, 965.79, 965.8, 965.8, 965.82, 965.85, 965.91, 965.98, 966.03, 966.1, 966.21, 966.37, 966.53, 966.73, 966.92, 967.01, 967.11, 967.18, 967.25, 967.31, 967.36, 967.38, 967.41, 967.44, 967.48, 967.49, 967.5, 967.55, 967.56, 967.56, 967.56, 967.58, 967.6, 967.61, ];
    const MARK_Y = [ 561.09, 557.32, 555.61, 554.2, 553.17, 552.32, 551.59, 551.01, 550.41, 549.95, 549.51, 549.05, 548.77, 548.5, 548.25, 548.02, 547.77, 547.55, 547.41, 547.33, 547.2, 547.08, 546.95, 546.86, 546.85, 546.81, 546.78, 546.73, 546.79, 546.94, 546.75, 546.75, 546.73, 546.76, 546.75, 546.77, 546.78, 546.77, 546.78, 546.79, 546.78, 546.8, 546.81, 546.79, 546.79, 546.79, 546.8, 546.8, 546.8, 546.81, 546.8, 546.8, 546.8, 546.8, 546.8, 546.79, 546.78, 546.77, 546.77, 546.77, 546.76, 546.76, 546.75, 546.75, 546.76, 546.76, 546.75, 546.75, 546.75, 546.75, 546.76, 546.75, 546.76, 546.76, 546.76, 546.76, 546.76, 546.76, ];
    const MARK_SCALE = [ 0.8113, 0.9106, 0.9483, 0.972, 0.9876, 0.9987, 1.0062, 1.0073, 1.0075, 1.0086, 1.0096, 1.01, 1.0098, 1.009, 1.0096, 1.0092, 1.0094, 1.0087, 1.0074, 1.004, 1.0018, 0.9981, 0.9926, 0.9898, 0.9846, 0.9776, 0.9693, 0.9601, 0.9456, 0.9177, 0.88, 0.83, 0.7752, 0.7462, 0.7278, 0.7136, 0.7035, 0.6973, 0.6874, 0.6825, 0.681, 0.6764, 0.6747, 0.6735, 0.6717, 0.6712, 0.671, 0.671, 0.6712, 0.6719, 0.6731, 0.6745, 0.6759, 0.6777, 0.6805, 0.685, 0.69, 0.6963, 0.7024, 0.7058, 0.7093, 0.7114, 0.7137, 0.7154, 0.7171, 0.718, 0.7188, 0.7198, 0.7211, 0.7212, 0.7216, 0.7225, 0.7228, 0.723, 0.7233, 0.724, 0.7248, 0.7248, ];
    const FLIP_FROM = 28;
    const FLIP_WIDTH = 65;
    const FLIP_PAPER = [2698.0, 947.9, 933.3, 919.0, 897.2, 810.3];
    const FLIP_INK = [2698.0, 1004.5, 943.6, 922.8, 903.4, 877.8];
    const LINE_SCALE = [ 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9163, 0.9159, 0.9168, 0.9172, 0.9176, 0.9183, 0.9192, 0.9196, 0.9204, 0.9212, 0.922, 0.9233, 0.9245, 0.9258, 0.9275, 0.9294, 0.9314, 0.9339, 0.9371, 0.9412, 0.947, 0.9545, 0.9627, 0.9705, 0.9769, 0.9813, 0.9842, 0.9868, 0.989, 0.991, 0.9927, 0.9942, 0.9953, 0.9967, 0.9978, 0.9987, 0.9995, 1.0001, 1.0007, 1.0011, 1.0017, 1.0022, 1.0025, ];
    const LINE_X = [ 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 9.05, 8.21, 6.95, 6.01, 5.17, 4.42, 3.85, 3.24, 2.63, 2.02, 1.56, 1.22, 0.79, 0.42, 0.27, 0.14, 0.07, 0.1, 0.07, 0.02, 0.16, 0.16, 0.04, -0.08, -0.02, 0.06, 0.07, 0.01, -0.08, -0.05, -0.04, -0.01, -0.01, 0.02, 0.02, 0.02, 0, -0.01, 0.01, 0.02, 0, 0, -0.03, -0.06, ];
    const WORD_RISE = [ 7.91, 5.66, 4.07, 2.82, 2.05, 1.4, 0.91, 0.59, 0.31, 0.1, -0.02, -0.06, -0.07, ];
    const WORD_FADE = [ 0.437, 0.603, 0.71, 0.795, 0.855, 0.896, 0.929, 0.955, 0.973, 0.991, 1.003, ];
    const LEAVE = { from: 65, stagger: 0.7 };
    const LEAVE_Y = [ -0.2, -0.33, -0.5, -0.72, -1.07, -1.44, -1.88, -2.42, -3.04, -3.82, -4.64, -5.61, -6.9, ];
    const LEAVE_FADE = [ 1, 1, 1, 1, 0.983, 0.98, 0.975, 0.971, 0.953, 0.943, 0.919, 0.904, 0.883, ];
    const LETTER_RISE = [ 16.2, 12.15, 10.26, 8.64, 7.29, 5.94, 5, 4.19, 3.51, 2.84, 2.29, 1.89, 1.49, 1.13, 0.81, 0.54, 0.32, 0.14, 0, ];
    const LETTER_FADE = [1, 0.7, 0.34, 0];
    const BRAND_MARK = { width: S.mark.width, height: S.mark.height, shapes: [S.mark.d] };
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const card = String(t.card);
    const fg = String(t.foreground);
    const STAGE_W = 1920;
    const STAGE_H = 1080;
    const MAX_LINE = STAGE_W * 0.86;
    const LOCKUP_FRAME = 12;
    const LINE_FRAME = 44;
    const LAYOUT_FRAME = 72;
    const logo = BRAND_MARK;
    const speed = Number(p.speed);
    const wordmark = String(p.wordmark);
    const before = String(p.before);
    const after = String(p.after);
    const face = S.pick(p.fontFamily, 'Geist');
    const markFace = S.pick(p.wordmarkFont, 'Poppins');
    const fontWeight = Number(p.fontWeight);
    const fontSize = Number(p.fontSize);
    const markWeight = Number(p.wordmarkWeight);
    const markSize = Number(p.wordmarkSize);
    const markTracking = Number(p.wordmarkTracking);
    const markGap = Number(p.wordmarkGap);
    const lockupColor = String(p.lockupColor);
    const px = Math.max(view.width / STAGE_W, view.height / STAGE_H);
    const left = before.trim().split(/\s+/).filter(Boolean);
    const right = after.trim().split(/\s+/).filter(Boolean);
    const letters = Array.from(wordmark);
    const ID = 'skl';

    const sample = (table: readonly number[], at: number) => {
      const x = Math.max(0, Math.min(at, table.length - 1));
      const i = Math.floor(x);
      const a = table[i] ?? 0;
      return a + ((table[i + 1] ?? a) - a) * (x - i);
    };
    const sourceFrame = (frame: number) => {
      const last = CUT[CUT.length - 1];
      if (frame >= last[0]) {
        return last[1];
      }
      const next = CUT.findIndex(([f]) => f > Math.max(0, frame));
      const [f0, s0] = CUT[next - 1];
      const [f1, s1] = CUT[next];
      return s0 + ((Math.max(0, frame) - f0) / (f1 - f0)) * (s1 - s0);
    };
    const beats = (count: number, from: number, to: number) => {
      const step = count > 1 ? (to - from) / (count - 1) : 0;
      return Array.from({ length: count }, (_, i) => from + i * step);
    };
    const wordBeats = (count: number, at: readonly number[]) => Array.from({ length: count }, (_, i) => (at[Math.min(i, at.length - 1)] ?? 0) + Math.max(0, i - at.length + 1) * LINE_ON.step);
    const layoutLine = (b: number[], a: number[], gap: number, tile: number) => {
      const l: number[] = [];
      let x = -tile / 2;
      for (let i = b.length - 1; i >= 0; i--) {
        x -= gap + (b[i] ?? 0);
        l.unshift(x);
      }
      const start = l[0] ?? -tile / 2;
      const r: number[] = [];
      let y = tile / 2;
      for (const w of a) {
        y += gap;
        r.push(y);
        y += w;
      }
      return { before: l, after: r, centre: (start + y) / 2, width: y - start };
    };
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    const em = (text: string, f: string, w: number, track: number) => {
      ctx.font = `${w} 100px ${f}`;
      (ctx as unknown as { letterSpacing: string }).letterSpacing = `${track * 100}px`;
      return ctx.measureText(text).width / 100 - track;
    };
    const measure = () => ({
      before: left.map((w) => em(w, face, fontWeight, TYPE_TRACKING)),
      after: right.map((w) => em(w, face, fontWeight, TYPE_TRACKING)),
      letters: letters.map((_, i) => (i === 0 ? 0 : em(letters.slice(0, i + 1).join(''), markFace, markWeight, markTracking) - em(letters[i] ?? '', markFace, markWeight, markTracking))),
      wordmark: em(wordmark, markFace, markWeight, markTracking)
    });

    const word = (x: number, y: number, scale: number, opacity: number, make: () => Element) => {
      if (opacity <= 0) {
        return null;
      }
      const row = Math.floor(y * px);
      const f = y * px - row;
      return S.h('g', { opacity, style: { isolation: 'isolate' } }, [{ r: row, w: 1 - f }, { r: row + 1, w: f }].map(({ r, w }) => S.h('g', { transform: `translate(${x} ${(r + 1e-3) / px}) scale(${scale})`, style: { opacity: w, mixBlendMode: 'plus-lighter' } }, make())));
    };

    const sky = String(p.sky ?? '');
    const img = S.h('img', { src: sky || null, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none', objectFit: 'cover', display: sky ? null : 'none' } }) as HTMLElement;
    const host = S.h('div', { style: { position: 'absolute', inset: 0 } }) as HTMLElement;
    view.root.replaceChildren(S.fill({ background: card, overflow: 'hidden' }, img, host));
    const tileStroke = S.mixOklch(String(t.border), card, TILE_LINE);
    const on = beats(letters.length, LETTERS_ON.from, LETTERS_ON.to);
    const off = beats(letters.length, LETTERS_OFF.to, LETTERS_OFF.from);

    return (at) => {
      const s = sourceFrame(at * speed);
      const m = measure();
      const tile72 = sample(TILE_SIZE, LAYOUT_FRAME);
      const lineAt = (size: number) => layoutLine(m.before.map((w) => w * size), m.after.map((w) => w * size), (WORD_GAP * size) / TYPE_SIZE, tile72);
      const full = lineAt(fontSize);
      const fit = Math.min(1, (MAX_LINE - tile72) / (full.width - tile72));
      const rest = lineAt(fontSize * fit);
      const lineShift = LINE_CENTER - sample(MARK_X, LAYOUT_FRAME) - rest.centre;
      const lockupWidth = LOCKUP_MARK + markGap + m.wordmark * markSize;
      const lockupShift = LOCKUP_CENTER - lockupWidth / 2 + LOCKUP_MARK / 2 - sample(MARK_X, LOCKUP_FRAME);
      const lockupX = sample(MARK_X, LOCKUP_FRAME);
      const glide = Math.max(0, Math.min(1, (sample(MARK_X, s) - lockupX) / ((sample(MARK_X, LINE_FRAME) - lockupX) * 0.85)));
      const markX = sample(MARK_X, s) + lockupShift * (1 - glide) + lineShift * glide;
      const markY = sample(MARK_Y, s);
      const markScale = sample(MARK_SCALE, s);
      const logoScale = LOCKUP_MARK / Math.max(logo.width, logo.height);
      const lineScale = sample(LINE_SCALE, s);
      const lineDrift = sample(LINE_X, s);
      img.style.transform = `scale(${1 + SKY_ZOOM.from * Math.exp(-s / SKY_ZOOM.tau)})`;
      const swing = sample(WIPE_LEAN, s);
      const lean = 1 + swing * swing;
      const wipe = sample(WIPE, s);
      const uMin = WIPE_STOPS[0];
      const uMax = WIPE_STOPS[WIPE_STOPS.length - 2];
      const flipShift = markX - sample(MARK_X, s);
      const flipPaper = sample(FLIP_PAPER, s - FLIP_FROM) + flipShift;
      const flipInk = sample(FLIP_INK, s - FLIP_FROM) + flipShift;
      const local = (x: number) => (x - markX) / (markScale * logoScale);
      const tile = sample(TILE_SIZE, s);

      const stops = WIPE_STOPS.flatMap((u, i) => (i % 2 ? [] : [S.h('stop', { offset: (u - uMin) / (uMax - uMin), stopColor: card, stopOpacity: WIPE_STOPS[i + 1] })]));
      const flips = [
        { id: 'p', at: flipPaper, from: 1, to: 0, c: lockupColor },
        { id: 'i', at: flipInk, from: 0, to: 1, c: fg }
      ].map((g) => S.h('linearGradient', { id: `${ID}${g.id}`, gradientUnits: 'userSpaceOnUse', x1: local(g.at - FLIP_WIDTH / 2) + logo.width / 2, x2: local(g.at + FLIP_WIDTH / 2) + logo.width / 2, y1: 0, y2: 0 }, S.h('stop', { offset: 0, stopColor: g.c, stopOpacity: g.from }), S.h('stop', { offset: 1, stopColor: g.c, stopOpacity: g.to })));
      const defs = S.h('defs', null, S.h('linearGradient', { id: `${ID}w`, gradientUnits: 'userSpaceOnUse', x1: wipe + uMin / lean, y1: STAGE_H / 2 + (swing * uMin) / lean, x2: wipe + uMax / lean, y2: STAGE_H / 2 + (swing * uMax) / lean }, stops), flips);

      const letterEls = letters.map((ch, i) => {
        const fade = sample(LETTER_FADE, s - (off[i] ?? 0));
        const k = s - (on[i] ?? 0);
        return word(markX + LOCKUP_MARK / 2 + markGap + (m.letters[i] ?? 0) * markSize, LOCKUP_Y + sample(LETTER_RISE, k), 1, k < 0 ? 0 : fade, () => S.h('text', { fill: lockupColor, style: { fontFamily: markFace, fontWeight: markWeight, fontSize: markSize, textRendering: 'geometricPrecision' } }, ch));
      });

      const mark = S.h(
        'g',
        { transform: `translate(${markX} ${markY})` },
        S.h('rect', { x: -tile / 2, y: -tile / 2, width: tile, height: tile, rx: (tile / 2) * TILE_RADIUS, fill: card, stroke: tileStroke, strokeWidth: TILE_STROKE, opacity: sample(TILE_FADE, s - FLIP_FROM) }),
        S.h('g', { transform: `scale(${markScale * logoScale}) translate(${-logo.width / 2} ${-logo.height / 2})` }, logo.shapes.map((d) => S.h('path', { d, fillRule: 'evenodd', fill: `url(#${ID}p)` })), logo.shapes.map((d) => S.h('path', { d, fillRule: 'evenodd', fill: `url(#${ID}i)` })))
      );

      const lineWords = [...left.map((w, i) => ({ w, x: rest.before[i] ?? 0, at: wordBeats(left.length, LINE_ON.first)[i] ?? 0 })), ...right.map((w, i) => ({ w, x: rest.after[i] ?? 0, at: wordBeats(right.length, LINE_ON.second)[i] ?? 0 }))];
      const wordEls = lineWords.map(({ w, x, at: beat }, i) => {
        const k = s - beat;
        const gone = s - LEAVE.from - i * LEAVE.stagger;
        const wx = LINE_PIVOT + lineScale * (sample(MARK_X, LAYOUT_FRAME) + lineShift + x - LINE_PIVOT) + lineDrift;
        const wy = LINE_Y + sample(WORD_RISE, k) + sample(LEAVE_Y, gone) + (lineScale - 1) * (LINE_Y - sample(MARK_Y, LAYOUT_FRAME));
        return word(wx, wy, lineScale * fit, k < 0 ? 0 : sample(WORD_FADE, k) * sample(LEAVE_FADE, gone), () => S.h('text', { fill: fg, style: { fontFamily: face, fontWeight, fontSize, letterSpacing: `${TYPE_TRACKING}em`, textRendering: 'geometricPrecision' } }, w));
      });

      host.replaceChildren(S.h('svg', { viewBox: `0 0 ${STAGE_W} ${STAGE_H}`, width: '100%', height: '100%', preserveAspectRatio: 'xMidYMid slice', style: { position: 'absolute', inset: 0 } }, defs, S.h('rect', { width: STAGE_W, height: STAGE_H, fill: `url(#${ID}w)` }), letterEls, mark, wordEls));
    };
  }
};
