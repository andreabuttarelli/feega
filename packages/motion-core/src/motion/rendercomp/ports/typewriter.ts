import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'typewriter',
  title: 'Typewriter',
  about: 'A flat typewriter pops in, its carriage slides across while keys press and lines print on the paper, then the message lands below.',
  category: RendercompCategory.Text,
  width: 1080,
  height: 1080,
  fps: 30,
  frames: 100,
  background: '#0f0c00',
  fonts: [],
  props: {
    messageText: { type: 'string', title: 'Message', default: 'Written', group: 'Content', maxLength: 40 },
    subText: { type: 'string', title: 'Subtitle', default: 'Words on paper', group: 'Content', maxLength: 80 },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0f0c00', group: 'Style' },
    machineColor: { type: 'string', title: 'Machine', format: PropFormat.Color, default: '#374151', group: 'Style' },
    machineDarkColor: { type: 'string', title: 'Machine (dark)', format: PropFormat.Color, default: '#1f2937', group: 'Style' },
    keyColor: { type: 'string', title: 'Keys', format: PropFormat.Color, default: '#4b5563', group: 'Style' },
    ribbonColor: { type: 'string', title: 'Ribbon', format: PropFormat.Color, default: '#dc2626', group: 'Style' },
    paperColor: { type: 'string', title: 'Paper', format: PropFormat.Color, default: '#f8fafc', group: 'Style' },
    textColor: { type: 'string', title: 'Message colour', format: PropFormat.Color, default: '#fef9c3', group: 'Style' },
    subColor: { type: 'string', title: 'Subtitle colour', format: PropFormat.Color, default: '#d97706', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const fps = 30;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const scale = Math.min(width, height);
    const cx = width / 2;
    const cy = height * 0.46;
    const mw = scale * 0.44;
    const mh = scale * 0.26;
    const ribbon = String(p.ribbonColor);
    const keyColor = String(p.keyColor);
    const dark = String(p.machineDarkColor);
    const keyRows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    const lineCount = 3;

    const rect = (x: number, y: number, w: number, h: number, rx: number, fill: string, opacity?: number) => S.h('rect', { x, y, width: w, height: h, rx, fill, opacity }) as SVGElement;

    const typedLines = Array.from({ length: lineCount }, (_, i) => rect(cx - mw * 0.2, cy - mh * 0.62 + i * scale * 0.022, 0, scale * 0.006, scale * 0.002, ribbon, 0.6));
    const paper = S.h('g', null, rect(cx - mw * 0.24, cy - mh * 0.7, mw * 0.48, mh * 0.55, scale * 0.004, String(p.paperColor)), ...typedLines) as SVGElement;
    const carriage = rect(0, cy - mh * 0.28, scale * 0.012, scale * 0.016, scale * 0.002, ribbon, 0.8);

    const kw = mw * 0.07;
    const kh = mw * 0.055;
    const gap = mw * 0.005;
    const keys = keyRows.flatMap((row, ri) => {
      const startX = cx - mw * 0.38 + ri * scale * 0.014;
      const startY = cy + mh * 0.12 + ri * (kh + gap);
      return row.split('').map((_, ci) => ({ index: ri * 10 + ci, el: rect(startX + ci * (kw + gap), startY, kw, kh, scale * 0.005, keyColor, 0.8) }));
    });

    const machine = S.h('g', null,
      rect(cx - mw / 2, cy - mh * 0.1, mw, mh * 1.1, scale * 0.018, String(p.machineColor)),
      rect(cx - mw / 2, cy - mh * 0.1, mw, mh * 0.28, scale * 0.018, dark),
      rect(cx - mw * 0.42, cy - mh * 0.38, mw * 0.84, scale * 0.028, scale * 0.01, dark),
      paper,
      rect(cx - mw * 0.3, cy - mh * 0.22, mw * 0.6, scale * 0.01, 0, ribbon, 0.6),
      carriage,
      ...keys.map((k) => k.el),
      rect(cx - mw * 0.22, cy + mh * 0.62, mw * 0.44, mw * 0.052, scale * 0.005, keyColor, 0.8)
    ) as SVGElement;
    const svg = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } }, machine);

    const message = S.h('div', { style: { fontFamily: face, fontSize: scale * 0.09, fontWeight: 900, color: String(p.textColor) } }, String(p.messageText)) as HTMLElement;
    const sub = S.h('div', { style: { fontFamily: face, fontSize: scale * 0.034, fontWeight: 500, color: String(p.subColor) } }, String(p.subText)) as HTMLElement;
    const caption = S.h('div', { style: { position: 'absolute', bottom: height * 0.1, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: scale * 0.01 } }, message, sub);
    view.root.replaceChildren(S.fill({ backgroundColor: String(p.backgroundColor) }, svg, caption));

    return (frame) => {
      const machineIn = S.spring({ frame, fps, config: { damping: 11, stiffness: 80 }, durationInFrames: 22 });
      const carriageProgress = S.interpolate(frame, [20, 72], [0, 1], clamped);
      const paperLines = Math.floor(carriageProgress * lineCount);
      const keyIdx = Math.floor(carriageProgress * 20) % 27;
      const textIn = S.spring({ frame: frame - 74, fps, config: { damping: 12, stiffness: 120 }, durationInFrames: 18 });

      machine.setAttribute('transform', `translate(${cx}, ${cy}) scale(${machineIn}) translate(${-cx}, ${-cy})`);
      paper.setAttribute('transform', `translate(0, ${-paperLines * scale * 0.018})`);
      carriage.setAttribute('x', String(cx - mw * 0.38 + carriageProgress * mw * 0.76));

      typedLines.forEach((line, i) => {
        const last = i === paperLines - 1;
        const fraction = last ? ((carriageProgress % (1 / 3)) * 3) : 1;
        line.setAttribute('width', String(i < paperLines ? mw * 0.35 * fraction : 0));
      });

      keys.forEach(({ index, el }) => {
        const pressed = index === keyIdx % 27;
        el.setAttribute('fill', pressed ? ribbon : keyColor);
        el.setAttribute('opacity', pressed ? '0.9' : '0.8');
      });

      message.style.opacity = String(textIn);
      message.style.transform = `scale(${0.75 + textIn * 0.25})`;
      sub.style.opacity = String(S.interpolate(frame, [88, 100], [0, 1], clamped));
    };
  }
};
