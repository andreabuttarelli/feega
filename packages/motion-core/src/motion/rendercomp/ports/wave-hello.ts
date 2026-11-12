import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'wave-hello',
  title: 'Wave hello',
  about: 'A friendly character slides up, settles with a small bounce and waves one arm while a greeting slides in beside it.',
  category: RendercompCategory.Loop,
  width: 1080,
  height: 1080,
  fps: 30,
  frames: 90,
  background: '#e0f2fe',
  fonts: [],
  props: {
    title: { type: 'string', title: 'Title', default: 'Hello!', group: 'Content', maxLength: 40 },
    subtitle: { type: 'string', title: 'Subtitle', default: 'Welcome aboard', group: 'Content', maxLength: 60 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#e0f2fe', group: 'Style' },
    skinColor: { type: 'string', title: 'Skin', format: PropFormat.Color, default: '#fbbf24', group: 'Style' },
    bodyColor: { type: 'string', title: 'Body', format: PropFormat.Color, default: '#3b82f6', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#1d4ed8', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#1e3a5f', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const FPS = 30;
    const width = view.width;
    const height = view.height;
    const FONT = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const skinColor = String(p.skinColor);
    const accentColor = String(p.accentColor);
    const INK = '#1e1e2e';
    const WAVE_START = 10;

    const scale = Math.min(width, height);
    const cx = width * 0.38;
    const headR = scale * 0.09;
    const bodyW = scale * 0.13;
    const bodyH = scale * 0.17;
    const armW = scale * 0.042;
    const armH = scale * 0.11;
    const legW = scale * 0.042;
    const legH = scale * 0.11;

    const svg = (tag: string, attrs: Record<string, unknown>) => S.h(tag, attrs) as unknown as SVGElement;
    const set = (el: SVGElement, attrs: Record<string, number | string>) => {
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    };

    const shadow = svg('ellipse', { cx, rx: bodyW * 0.75, ry: scale * 0.016, fill: 'rgba(0,0,0,0.08)' });
    const legLeft = svg('rect', { x: cx - bodyW * 0.28 - legW / 2, width: legW, height: legH, rx: legW / 2, fill: accentColor });
    const legRight = svg('rect', { x: cx + bodyW * 0.28 - legW / 2, width: legW, height: legH, rx: legW / 2, fill: accentColor });
    const body = svg('rect', { x: cx - bodyW / 2, width: bodyW, height: bodyH, rx: bodyW * 0.22, fill: String(p.bodyColor) });
    const armRest = svg('rect', { x: cx - bodyW * 0.5 - armW, width: armW, height: armH, rx: armW / 2, fill: skinColor });
    const shoulderX = cx + bodyW * 0.48;
    const armWave = svg('rect', { x: shoulderX, width: armW, height: armH, rx: armW / 2, fill: skinColor });
    const hand = svg('circle', { cx: shoulderX + armW / 2, r: armW * 0.65, fill: skinColor });
    const wavingArm = svg('g', {});
    wavingArm.appendChild(armWave);
    wavingArm.appendChild(hand);

    const head = svg('circle', { cx, r: headR, fill: skinColor });
    const eyeLeft = svg('circle', { cx: cx - headR * 0.3, r: headR * 0.1, fill: INK });
    const eyeRight = svg('circle', { cx: cx + headR * 0.3, r: headR * 0.1, fill: INK });
    const smile = svg('path', { stroke: INK, strokeWidth: scale * 0.007, strokeLinecap: 'round', fill: 'none' });
    const tuft = svg('path', { stroke: accentColor, strokeWidth: scale * 0.01, strokeLinecap: 'round', fill: 'none', opacity: 0.7 });

    const canvas = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } }, shadow, legLeft, legRight, body, armRest, wavingArm, head, eyeLeft, eyeRight, smile, tuft);

    const subtitle = String(p.subtitle);
    const titleEl = S.h('div', { style: { fontFamily: FONT, fontSize: scale * 0.1, fontWeight: 800, color: accentColor, lineHeight: 1 } }, String(p.title));
    const subtitleEl = subtitle ? S.h('div', { style: { fontFamily: FONT, fontSize: scale * 0.038, fontWeight: 400, color: String(p.textColor), opacity: 0.72 } }, subtitle) : null;
    const textBlock = S.h('div', { style: { position: 'absolute', left: width * 0.54, top: '50%', display: 'flex', flexDirection: 'column', gap: scale * 0.014 } }, titleEl, subtitleEl) as HTMLElement;

    view.root.replaceChildren(S.fill({ backgroundColor: String(p.backgroundColor) }, canvas, textBlock));

    return (frame) => {
      const charIn = S.spring({ frame, fps: FPS, config: { damping: 12, stiffness: 100, mass: 0.8 }, durationInFrames: 20 });
      const charOffsetY = S.interpolate(charIn, [0, 1], [height * 0.18, 0]);
      const bounce = charIn >= 0.99 ? Math.sin((frame - 18) * 0.22) * scale * 0.008 : 0;
      const cy = height * 0.5 + charOffsetY + bounce;

      const waveAngle = frame > WAVE_START ? S.interpolate(Math.sin((frame - WAVE_START) * 0.3), [-1, 1], [-25, 50]) : 0;
      const shoulderY = cy - bodyH * 0.32;
      const headCY = cy - bodyH * 0.5 - headR * 0.65;

      set(shadow, { cy: cy + bodyH * 0.5 + legH + scale * 0.008 });
      set(legLeft, { y: cy + bodyH * 0.44 });
      set(legRight, { y: cy + bodyH * 0.44 });
      set(body, { y: cy - bodyH * 0.5 });
      set(armRest, { y: cy - bodyH * 0.28 });

      set(wavingArm, { transform: `rotate(${waveAngle} ${shoulderX} ${shoulderY})` });
      set(armWave, { y: shoulderY });
      set(hand, { cy: shoulderY + armH });

      set(head, { cy: headCY });
      set(eyeLeft, { cy: headCY - headR * 0.12 });
      set(eyeRight, { cy: headCY - headR * 0.12 });
      set(smile, { d: `M ${cx - headR * 0.28} ${headCY + headR * 0.18} Q ${cx} ${headCY + headR * 0.45} ${cx + headR * 0.28} ${headCY + headR * 0.18}` });
      set(tuft, { d: `M ${cx - headR * 0.15} ${headCY - headR * 0.88} Q ${cx} ${headCY - headR * 1.18} ${cx + headR * 0.15} ${headCY - headR * 0.88}` });

      const textIn = S.spring({ frame: frame - 30, fps: FPS, config: { damping: 14, stiffness: 90 }, durationInFrames: 20 });
      textBlock.style.opacity = String(textIn);
      textBlock.style.transform = `translateY(-50%) translateX(${S.interpolate(textIn, [0, 1], [50, 0])}px)`;
    };
  }
};
