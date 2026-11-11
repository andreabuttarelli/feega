import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'spec-sweep',
  title: 'Spec sweep',
  about: 'One centred line arrives word by word, a soft highlight reads it out and a bolt icon charges up from the bottom.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#0a0a0b',
  fonts: ['Inter'],
  props: {
    lead: { type: 'string', title: 'Lead words', default: 'Ship', group: 'Content', maxLength: 80 },
    accentText: { type: 'string', title: 'Accent words', default: 'a launch film', group: 'Content', maxLength: 80 },
    mutedText: { type: 'string', title: 'Muted words', default: 'in', group: 'Content', maxLength: 80 },
    tail: { type: 'string', title: 'Closing accent words', default: '20 minutes', group: 'Content', maxLength: 80 },
    showIcon: { type: 'string', title: 'Icon', enum: ['on', 'off'], default: 'on', group: 'Content' },
    fontSize: { type: 'number', title: 'Font size (px on 1920)', default: 85.15, minimum: 12, maximum: 300, step: 0.05, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 500, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    accentColor: { type: 'string', title: 'Icon colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    color: { type: 'string', title: 'Text colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'dark', group: 'Style' },
    iconSize: { type: 'number', title: 'Icon height (em)', default: 1.452, minimum: 0.2, maximum: 4, step: 0.01, group: 'Style' },
    iconDim: { type: 'number', title: 'Icon opacity before charge', default: 0.39, minimum: 0, maximum: 1, step: 0.01, group: 'Style' },
    mutedLevel: { type: 'number', title: 'Muted level', default: 0.6, minimum: 0, maximum: 1, step: 0.01, group: 'Style' },
    travel: { type: 'number', title: 'Slide distance (em)', default: 1.466, minimum: 0, maximum: 5, step: 0.01, group: 'Motion' },
    stagger: { type: 'number', title: 'Word stagger (frames)', default: 2, minimum: 0, maximum: 20, step: 0.5, group: 'Motion' },
    sweepFrames: { type: 'number', title: 'Sweep length (frames)', default: 54, minimum: 1, maximum: 300, step: 1, group: 'Motion' },
    chargeDelay: { type: 'number', title: 'Charge delay (frames)', default: 11.47, minimum: 0, maximum: 120, step: 0.5, group: 'Motion' },
    chargeFrames: { type: 'number', title: 'Charge length (frames)', default: 30, minimum: 1, maximum: 120, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const ENTRY = [1, 0.64, 0.484, 0.374, 0.29, 0.224, 0.172, 0.128, 0.094, 0.066, 0.044, 0.028, 0.016, 0.008, 0.002, 0];
    const SWEEP = [[-50, 0.255], [-49, 0.271], [-45, 0.377], [-42, 0.437], [-39, 0.467], [-31, 0.525], [-25, 0.587], [-12, 0.806], [-5, 0.966], [-3, 0.99], [0, 1], [4, 0.995], [6, 0.974], [13, 0.81], [26, 0.588], [33, 0.517], [43, 0.462], [51, 0.365]];
    const BOLT = 'M54.13 2.15A5.78 5.78 0 0 1 64.00 7.96L47.41 48.65A1.03 1.03 0 0 0 48.36 50.07L78.20 50.31A4.41 4.41 0 0 1 81.63 57.46L30.83 121.75A5.39 5.39 0 0 1 21.55 116.54L37.50 73.40L6.96 72.69A4.58 4.58 0 0 1 3.50 65.25Z';
    const BOX = [83.07, 123.79];
    const MAX_LINE = 0.85;
    const LAST_ENTRY = 14;
    const SWEEP_START = 1.476;
    const SWEEP_LEAD = 6.093;
    const BASELINE = 0.258;
    const STOP_EVERY = 8;
    const ICON_RIM = 1.47;
    const held = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const chargeEase = S.Easing.bezier(0.166, 0.092, 0.279, 1);
    const ENTRY_AT = ENTRY.map((_, i) => i);
    const SWEEP_AT = SWEEP.map((s) => s[0]);
    const SWEEP_LEVEL = SWEEP.map((s) => s[1]);
    const { width, height } = view;
    const stage = Math.min(width / 1920, height / 1080);
    let redraw = () => {};
    const FACE = 'Spec Sweep Inter';
    const FACE_URL = 'https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2';
    if (typeof FontFace !== 'undefined' && ![...document.fonts].some((f) => f.family === FACE)) {
      const loaded = new FontFace(FACE, `url(${FACE_URL}) format("woff2")`, { weight: '100 900' });
      document.fonts.add(loaded);
      loaded.load().then(() => redraw()).catch(() => undefined);
    }
    const family = S.pick(p.fontFamily, `"${FACE}", Inter`);
    const fontWeight = Number(p.fontWeight);
    const iconSize = Number(p.iconSize);
    const travel = Number(p.travel);
    const mutedLevel = Number(p.mutedLevel);
    const iconDim = Number(p.iconDim);
    const chargeDelay = Number(p.chargeDelay);
    const chargeFrames = Number(p.chargeFrames);
    const speed = Number(p.speed);
    const accent = S.pick(p.accentColor, String(t.primary));
    const rimColor = S.mixOklch(accent, '#ffffff', 0.3);
    const ink = S.pick(p.color, String(t.foreground));
    const segments = [
      { text: String(p.lead), role: 'lead' },
      ...(p.showIcon === 'off' ? [] : [{ text: '', role: 'icon' }]),
      { text: String(p.accentText), role: 'accent' },
      { text: String(p.mutedText), role: 'muted' },
      { text: String(p.tail), role: 'accent' }
    ];
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    let uid = 0;

    const sweepLevel = (role: string, at: number) => {
      if (role === 'accent' && at > 0) {
        return 1;
      }
      const level = S.interpolate(at, SWEEP_AT, SWEEP_LEVEL, held);
      return role === 'muted' ? Math.min(level, mutedLevel) : level;
    };

    const place = (size: number) => {
      ctx.font = `${fontWeight} ${size}px ${family}`;
      const measure = (s: string) => ctx.measureText(s).width;
      const space = measure(' ');
      const items: { role: string; text: string; x: number; w: number }[] = [];
      let x = 0;
      const push = (role: string, text: string, w: number) => {
        items.push({ role, text, x, w });
        x += w + space;
      };
      for (const s of segments) {
        if (s.role === 'icon') {
          push('icon', '', (size * iconSize * BOX[0]) / BOX[1]);
          continue;
        }
        s.text.split(/\s+/).filter(Boolean).forEach((word) => push(s.role, word, measure(word)));
      }
      return { items, width: Math.max(0, x - space) };
    };

    const layout = () => {
      const size = Number(p.fontSize) * stage;
      const first = place(size);
      const fit = Math.min(1, (MAX_LINE * width) / Math.max(1, first.width));
      const fitted = fit < 1 ? place(size * fit) : first;
      return { ...fitted, size: size * fit, left: (width - fitted.width) / 2 };
    };

    const svg = S.h('svg', { width, height, style: { position: 'absolute', inset: 0, overflow: 'hidden' } });
    view.root.replaceChildren(S.fill({ background: 'transparent' }, svg));

    const iconNode = (x: number, age: number, size: number) => {
      const iconH = size * iconSize;
      const iconScale = iconH / BOX[1];
      const charge = chargeEase(Math.min(1, Math.max(0, (age - chargeDelay) / chargeFrames)));
      const level = BOX[1] * (1.006 - 1.018 * charge);
      const clip = `ss${uid++}`;
      const shape = () => [S.h('path', { d: BOLT, fill: accent }), S.h('path', { d: BOLT, fill: 'none', stroke: rimColor, strokeWidth: (2 * ICON_RIM * stage) / iconScale, clipPath: `url(#${clip})` })];
      return S.h('g', { transform: `translate(${x} ${height / 2 - iconH / 2}) scale(${iconScale})` },
        S.h('clipPath', { id: clip }, S.h('path', { d: BOLT })),
        S.h('clipPath', { id: `${clip}a` }, S.h('rect', { x: -9e3, y: -9e3, width: 18e3, height: 9e3 + level })),
        S.h('clipPath', { id: `${clip}b` }, S.h('rect', { x: -9e3, y: level, width: 18e3, height: 9e3 })),
        S.h('g', { clipPath: `url(#${clip}a)`, opacity: iconDim }, shape()),
        S.h('g', { clipPath: `url(#${clip}b)` }, shape()));
    };

    const render = (at: number) => {
      redraw = () => render(at);
      const f = at * speed;
      const line = layout();
      const { items, size, left } = line;
      const step = Math.min(Number(p.stagger), LAST_ENTRY / Math.max(1, items.length - 1));
      const rate = line.width / Number(p.sweepFrames);
      const baseline = height / 2 + BASELINE * size;
      uid = 0;
      const nodes: Element[] = [];
      items.forEach((item, i) => {
        const age = f - step * i;
        if (age < 0) {
          return;
        }
        const off = S.interpolate(age, ENTRY_AT, ENTRY, held);
        const x = left + item.x + off * travel * size;
        if (item.role === 'icon') {
          nodes.push(iconNode(x, age, size));
          return;
        }
        const grad = `ssg${uid++}`;
        const from = age + SWEEP_LEAD * off - SWEEP_START - item.x / rate;
        const n = Math.max(2, Math.ceil(item.w / (STOP_EVERY * stage)));
        const stops = Array.from({ length: n + 1 }, (_, k) => S.h('stop', { offset: k / n, stopColor: ink, stopOpacity: sweepLevel(item.role, from - ((k / n) * item.w) / rate) }));
        const text = S.h('text', { x, y: baseline, fill: `url(#${grad})`, style: { fontFamily: family, fontWeight, fontSize: size, textRendering: 'geometricPrecision' } }, item.text);
        nodes.push(S.h('g', null, S.h('linearGradient', { id: grad, gradientUnits: 'userSpaceOnUse', x1: x, x2: x + item.w, y1: 0, y2: 0 }, stops), text));
      });
      svg.replaceChildren(...nodes);
    };
    return render;
  }
};
