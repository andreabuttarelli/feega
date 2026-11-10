import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'title-sweep',
  title: 'Title sweep',
  about: 'A centred title lit by a warm gradient that sweeps across it, cutting to the next title on black while the shot slowly pulls back.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#000000',
  fonts: ['Inter'],
  props: {
    titles: { type: 'string', title: 'Titles (one per line)', default: 'snapcn Pro\nsnapcn.dev', group: 'Content', maxLength: 400 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    fontSize: { type: 'number', title: 'Font size (px on 1920)', default: 110.96, minimum: 12, maximum: 400, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 500, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    tracking: { type: 'number', title: 'Letter spacing (em)', default: -0.0165, minimum: -0.2, maximum: 0.5, step: 0.001, group: 'Style' },
    wordSpacing: { type: 'number', title: 'Word spacing (em)', default: -0.0769, minimum: -0.5, maximum: 1, step: 0.001, group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const STOPS = [[-17.52, '#000000'], [-16.727, '#030200'], [-15.934, '#0d0600'], [-15.141, '#160a00'], [-14.348, '#210c01'], [-13.482, '#2d1001'], [-12.689, '#431502'], [-11.896, '#581902'], [-11.103, '#631d08'], [-10.31, '#88300f'], [-9.517, '#9e3f18'], [-8.724, '#ce5c22'], [-7.931, '#d86629'], [-7.066, '#eb7535'], [-6.273, '#e3793d'], [-5.479, '#db7f47'], [-4.686, '#e6935b'], [-3.893, '#f0a771'], [-3.1, '#f4b784'], [-2.307, '#f1bd8d'], [-1.514, '#eebd8f'], [-0.721, '#e3ae7f'], [0.144, '#e4a471'], [0.937, '#ef9c62'], [1.73, '#eb8c4f'], [2.523, '#e77f42'], [3.317, '#e37537'], [4.11, '#dc6d31'], [4.903, '#d5652b'], [5.696, '#d16127'], [6.489, '#af4c1e'], [7.354, '#943917'], [8.147, '#7a2810'], [8.94, '#671e09'], [9.733, '#561905'], [10.526, '#461604'], [11.319, '#3d1404'], [12.112, '#2a0f02'], [12.906, '#1f0d01'], [13.771, '#130901'], [14.564, '#0d0601'], [15.357, '#070400'], [16.15, '#030100'], [16.943, '#000000']];
    const SWEEP_FIRST = [-6.625, -6.007, -5.192, -4.403, -3.78, -3.342, -2.969, -2.554, -2.033, -1.439, -0.862, -0.383, -0.01, 0.344, 0.662, 0.895, 1.061, 1.148, 1.198, 1.326, 1.55, 1.781, 2.079, 2.506, 3.078, 3.821, 4.705, 5.657, 6.652, 7.781, 9.099, 10.546, 12.024, 13.444, 14.647, 15.396,];
    const SWEEP_LAST = [-17.907, -17.152, -16.058, -14.785, -13.36, -11.904, -10.494, -9.072, -7.668, -6.398, -5.281, -4.343, -3.632, -3.026, -2.412, -1.792, -1.193, -0.646, -0.196, 0.192, 0.518, 0.747, 0.918, 1.008, 1.048, 1.148, 1.359, 1.621, 1.879, 2.148, 2.495, 2.889, 3.31, 3.745, 4.168, 4.589, 5.014, 5.441, 5.859, 6.193,];
    const STAGE_W = 1920;
    const STAGE_H = 1080;
    const MAX_LINE = 0.9;
    const REF_LINE = 7.6;
    const TITLE_FRAMES = 36;
    const PULL_BACK = 0.00119;
    const BASELINE = 0.267;

    const titles = String(p.titles).split('\n').filter((t) => t.length > 0);
    const FACE = 'Title Sweep Inter';
    const fontWeight = Number(p.fontWeight);
    if (typeof FontFace !== 'undefined' && ![...document.fonts].some((f) => f.family === FACE)) {
      const loaded = new FontFace(FACE, 'url(https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2) format("woff2")', { weight: '100 900' });
      document.fonts.add(loaded);
      loaded.load().catch(() => undefined);
    }
    const family = S.pick(p.fontFamily, `"${FACE}", Inter`);
    const fontSize = Number(p.fontSize);
    const tracking = Number(p.tracking);
    const wordSpacing = Number(p.wordSpacing);
    const speed = Number(p.speed);
    const fontSpec = `${fontWeight} 100px ${family}`;
    const ctx = document.createElement('canvas').getContext('2d');

    const sample = (table: number[], at: number) => {
      const i = Math.min(Math.max(Math.floor(at), 0), table.length - 1);
      const from = table[i] ?? 0;
      const to = table[i + 1] ?? from;
      return from + (to - from) * Math.min(1, Math.max(0, at - i));
    };

    const lineEmOf = (text: string) => {
      if (!ctx) {
        return text.length * 0.55;
      }
      ctx.font = fontSpec;
      return ctx.measureText(text).width / 100 + text.length * tracking + (text.split(' ').length - 1) * wordSpacing;
    };

    const first = STOPS[0][0] as number;
    const span = (STOPS[STOPS.length - 1][0] as number) - first || 1;
    const gradient = S.h('linearGradient', { id: 'snapcn-title-sweep', gradientUnits: 'userSpaceOnUse', y1: 0, y2: 0 }, STOPS.map(([at, color]) => S.h('stop', { offset: ((at as number) - first) / span, stopColor: color })));
    const text = S.h('text', { textAnchor: 'middle', fill: 'url(#snapcn-title-sweep)', style: { fontFamily: family, fontWeight, letterSpacing: `${tracking}em`, wordSpacing: `${wordSpacing}em`, textRendering: 'geometricPrecision' } });
    const group = S.h('g', null, text);
    const svg = S.h('svg', { viewBox: `0 0 ${STAGE_W} ${STAGE_H}`, width: view.width, height: view.height, style: { position: 'absolute', inset: 0, overflow: 'hidden' } }, S.h('defs', null, gradient), group);
    view.root.replaceChildren(S.fill({ background: 'transparent' }, svg));

    return (at) => {
      const f = at * speed;
      const index = Math.min(Math.floor(Math.max(0, f) / TITLE_FRAMES), Math.max(0, titles.length - 1));
      const age = Math.max(0, f) - index * TITLE_FRAMES;
      const label = titles[index] ?? '';
      const lineEm = lineEmOf(label);
      const fit = Math.min(1, (MAX_LINE * STAGE_W) / Math.max(1, lineEm * fontSize));
      const size = fontSize * fit;
      const reach = Math.max(1, lineEm / REF_LINE) * size;
      const table = titles.length > 1 && index === titles.length - 1 ? SWEEP_LAST : SWEEP_FIRST;
      const centre = STAGE_W / 2 + sample(table, age) * reach;
      gradient.setAttribute('x1', String(centre + first * reach));
      gradient.setAttribute('x2', String(centre + (first + span) * reach));
      group.setAttribute('transform', `translate(960 540) scale(${Math.max(0.5, 1 - PULL_BACK * f)}) translate(-960 -540)`);
      text.setAttribute('x', String(STAGE_W / 2));
      text.setAttribute('y', String(STAGE_H / 2 + BASELINE * size));
      (text as SVGElement).style.fontSize = `${size}px`;
      if (text.textContent !== label) {
        text.textContent = label;
      }
    };
  }
};
