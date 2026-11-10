import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

const face = (title: string, family: string) => ({ type: 'string' as const, title, format: PropFormat.Font, default: family, group: 'Style' });

export const PORT: SnapcnPort = {
  id: 'font-shuffle',
  title: 'Font shuffle',
  about: 'A headline glitches in, settles in serif, then the subject cycles through a dozen typefaces.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 115,
  background: '#faf9f6',
  fonts: ['Source Serif 4', 'Libre Baskerville', 'Source Code Pro', 'Inter', 'Hind', 'VT323', 'Mona Sans', 'Pacifico', 'Zilla Slab', 'Bebas Neue', 'Playfair Display', 'UnifrakturMaguntia', 'Unbounded'],
  props: {
    lead: { type: 'string', title: 'Lead', default: 'Introducing', group: 'Content', maxLength: 40 },
    subject: { type: 'string', title: 'Subject', default: 'snapcn Pro', group: 'Content', maxLength: 40 },
    accent: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#9b8ed3', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    serif: face('Serif face', 'Source Serif 4'),
    glitch: face('Glitch face', 'Libre Baskerville'),
    mono: face('Mono face', 'Source Code Pro'),
    light: face('Light face', 'Inter'),
    humanist: face('Humanist face', 'Hind'),
    pixel: face('Pixel face', 'VT323'),
    grotesk: face('Grotesk face', 'Mona Sans'),
    script: face('Script face', 'Pacifico'),
    slab: face('Slab face', 'Zilla Slab'),
    condensed: face('Condensed face', 'Bebas Neue'),
    italic: face('Italic face', 'Playfair Display'),
    blackletter: face('Blackletter face', 'UnifrakturMaguntia'),
    wide: face('Wide face', 'Unbounded')
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const fg = String(t.foreground);
    const accent = S.pick(p.accent, '#9b8ed3');
    const REF_W = 638;
    const REF_H = 358;
    const REF_LEN = 24;
    type Run = { face: string; size: number; weight: number; track: number; space?: number };
    type Extra = { ch: string; at: number; dx: number; base: number; size: number; weight: number };
    type Beat = { kind: 'glitch'; run: Run; cx: number; base: number; show: number[]; extras: Extra[] } | { kind: 'pair'; lead: Run; subject: Run; leadBase: number; subjectBase: number; gap: number; cx: number; accent: boolean; hide?: number[] };
    const serif = (size: number, weight: number, track: number): Run => ({ face: 'serif', size, weight, track });
    const BEATS: [number, Beat][] = [
      [0, { kind: 'glitch', run: { face: 'glitch', size: 28.25, weight: 416, track: -0.94 }, cx: 317.597, base: 186.43, show: [2, 4, 7, 10, 14, 17, 19, 22], extras: [{ ch: 'i', at: 1, dx: -2.643, base: 189.25, size: 33.95, weight: 700 }, { ch: 'l', at: 1, dx: 7.527, base: 189.55, size: 35.55, weight: 691 }, { ch: 'e', at: 5, dx: 4.176, base: 189.59, size: 36.56, weight: 670 }, { ch: 'b', at: 11, dx: -1.19, base: 189.73, size: 36.46, weight: 400 }, { ch: 'a', at: 20, dx: -3.586, base: 190.12, size: 35.92, weight: 641 }, { ch: 'e', at: 23, dx: 22.728, base: 189.5, size: 36.53, weight: 673 }] }],
      [2, { kind: 'glitch', run: { face: 'glitch', size: 28.8, weight: 401, track: -0.12 }, cx: 317.722, base: 186.78, show: [0, 1, 2, 4, 7, 9, 10, 13, 14, 15, 17, 19, 22, 23], extras: [{ ch: 'b', at: 11, dx: -1.886, base: 191.01, size: 40.27, weight: 523 }, { ch: 'e', at: 23, dx: 26.711, base: 190.38, size: 39.71, weight: 635 }] }],
      [4, { kind: 'pair', lead: serif(38.31, 489, -1.144), subject: serif(38.31, 489, -1.144), leadBase: 188.26, subjectBase: 188.26, gap: 7.719, cx: 317.543, accent: true, hide: [3, 6, 16] }],
      [6, { kind: 'pair', lead: serif(41.98, 502, -1.325), subject: serif(41.98, 502, -1.325), leadBase: 189.35, subjectBase: 189.35, gap: 8.375, cx: 317.475, accent: true }],
      [7, { kind: 'pair', lead: serif(42, 573, -1.4), subject: { ...serif(42, 573, -1.4), space: 1.263 }, leadBase: 189.29, subjectBase: 189.29, gap: 9.951, cx: 317.943, accent: false }],
      [32, { kind: 'pair', lead: serif(43.48, 511, -1.273), subject: { face: 'mono', size: 39.96, weight: 354, track: -2.741, space: 0.765 }, leadBase: 189.603, subjectBase: 189.296, gap: 6.927, cx: 317.275, accent: false }],
      [35, { kind: 'pair', lead: serif(45.898, 546, -1.673), subject: { face: 'light', size: 42.488, weight: 392, track: -0.819, space: 5.88 }, leadBase: 190.225, subjectBase: 189.492, gap: 11.558, cx: 316.424, accent: false }],
      [39, { kind: 'pair', lead: serif(46.968, 509, -1.21), subject: { face: 'humanist', size: 46.707, weight: 400, track: 0.936, space: -0.358 }, leadBase: 190.563, subjectBase: 190.696, gap: 12.875, cx: 315.741, accent: false }],
      [43, { kind: 'pair', lead: serif(48.696, 518, -1.197), subject: { face: 'pixel', size: 67.469, weight: 400, track: -2.468, space: -4.337 }, leadBase: 190.919, subjectBase: 191.087, gap: 5.67, cx: 316.477, accent: false }],
      [47, { kind: 'pair', lead: serif(49.285, 524, -1.26), subject: { face: 'script', size: 45.342, weight: 400, track: 0 }, leadBase: 191.071, subjectBase: 191.071, gap: 11, cx: 316.4, accent: false }],
      [51, { kind: 'pair', lead: serif(49.875, 530, -1.32), subject: { face: 'slab', size: 53.865, weight: 600, track: -0.8 }, leadBase: 191.223, subjectBase: 191.223, gap: 11, cx: 316.4, accent: false }],
      [54, { kind: 'pair', lead: serif(50.464, 536, -1.38), subject: { face: 'condensed', size: 60.557, weight: 400, track: 0.6 }, leadBase: 191.375, subjectBase: 191.375, gap: 11, cx: 316.4, accent: false }],
      [58, { kind: 'pair', lead: serif(51.054, 541, -1.44), subject: { face: 'italic', size: 53.096, weight: 560, track: -0.8 }, leadBase: 191.528, subjectBase: 191.528, gap: 11, cx: 316.4, accent: false }],
      [61, { kind: 'pair', lead: serif(51.643, 547, -1.5), subject: { face: 'blackletter', size: 59.389, weight: 400, track: 0 }, leadBase: 191.68, subjectBase: 191.68, gap: 11, cx: 316.4, accent: false }],
      [65, { kind: 'pair', lead: serif(52.233, 553, -1.56), subject: { face: 'wide', size: 41.786, weight: 520, track: -1.4 }, leadBase: 191.832, subjectBase: 191.832, gap: 11, cx: 316.4, accent: false }],
      [69, { kind: 'pair', lead: serif(52.822, 559, -1.594), subject: { face: 'grotesk', size: 51.994, weight: 575, track: -1.689, space: 0.327 }, leadBase: 191.984, subjectBase: 192.782, gap: 11.638, cx: 316.37, accent: false }]
    ];

    const lead = String(p.lead);
    const subject = String(p.subject);
    const line = `${lead} ${subject}`;
    const n = line.length;
    const refIndex = (i: number) => (n <= 1 ? 0 : Math.round((i * (REF_LEN - 1)) / (n - 1)));
    const ownIndex = (r: number) => (n <= 1 ? 0 : Math.round((r * (n - 1)) / (REF_LEN - 1)));

    const runStyle = (run: Run) => ({
      fontFamily: String(p[run.face]),
      fontSize: run.size,
      fontWeight: run.weight,
      fontStyle: run.face === 'italic' ? 'italic' : undefined,
      letterSpacing: `${run.track}px`,
      wordSpacing: `${run.space ?? 0}px`,
      fontOpticalSizing: run.face === 'light' ? 'none' : undefined,
      fontVariationSettings: run.face === 'serif' ? '"opsz" 16' : undefined,
      whiteSpace: 'pre',
      textRendering: 'geometricPrecision'
    });
    const text = (run: Run, attrs: Record<string, unknown>, ...kids: (Element | string)[]) => S.h('text', { ...attrs, style: runStyle(run) }, ...kids) as SVGTextElement;
    const chars = (s: string, offset: number, visible: (r: number) => boolean) => [...s].map((ch, i) => S.h('tspan', { fillOpacity: visible(refIndex(offset + i)) ? 1 : 0 }, ch));

    const svg = S.h('svg', { viewBox: `0 0 ${REF_W} ${REF_H}`, preserveAspectRatio: 'xMidYMid meet', style: { width: '100%', height: '100%', overflow: 'visible' } }) as SVGSVGElement;
    const warm = S.h('svg', { style: { position: 'absolute', width: 0, height: 0, opacity: 0 } }, BEATS.flatMap(([, b]) => (b.kind === 'glitch' ? [b.run, ...b.extras.map((e) => ({ ...b.run, size: e.size, weight: e.weight }))] : [b.lead, b.subject]).map((run) => S.h('text', { style: runStyle(run) }, line))));
    const extra = S.h('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@600&family=Playfair+Display:ital,wght@1,400..900&display=block' });
    view.root.replaceChildren(S.fill({ backgroundColor: String(t.background) }, extra, svg, warm));

    const glitch = (beat: Extract<Beat, { kind: 'glitch' }>) => {
      const shown = new Set(beat.show);
      const main = text(beat.run, { y: beat.base }, ...chars(line, 0, (r) => shown.has(r)));
      const g = S.h('g', { fill: fg }, main);
      svg.replaceChildren(g);
      const x0 = beat.cx - main.getComputedTextLength() / 2;
      main.setAttribute('x', String(x0));
      beat.extras.forEach((e) => {
        const at = Math.min(n - 1, ownIndex(e.at));
        const start = at < main.getNumberOfChars() ? main.getStartPositionOfChar(at).x - x0 : 0;
        g.append(text({ ...beat.run, size: e.size, weight: e.weight, track: 0 }, { x: x0 + start + e.dx, y: e.base }, e.ch));
      });
    };

    const pair = (beat: Extract<Beat, { kind: 'pair' }>) => {
      const hidden = new Set(beat.hide ?? []);
      const a = text(beat.lead, { y: beat.leadBase }, ...chars(lead, 0, (r) => !hidden.has(r)));
      const b = text(beat.subject, { y: beat.subjectBase }, ...chars(subject, lead.length + 1, (r) => !hidden.has(r)));
      svg.replaceChildren(S.h('g', { fill: beat.accent ? accent : fg }, a, b));
      const wl = a.getComputedTextLength();
      const x0 = beat.cx - (wl + beat.gap + b.getComputedTextLength()) / 2;
      a.setAttribute('x', String(x0));
      b.setAttribute('x', String(x0 + wl + beat.gap));
    };

    return (frame) => {
      const found = BEATS.filter(([at]) => frame >= at).pop() ?? BEATS[0];
      const beat = found[1];
      if (beat.kind === 'glitch') {
        glitch(beat);
        return;
      }
      pair(beat);
    };
  }
};
