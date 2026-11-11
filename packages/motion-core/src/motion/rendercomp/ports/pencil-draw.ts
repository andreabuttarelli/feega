import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'pencil-draw',
  title: 'Pencil draw',
  about: 'A pencil draws a star outline stroke by stroke, then a message springs in with a subtitle.',
  category: RendercompCategory.Loop,
  width: 1080,
  height: 1080,
  fps: 30,
  frames: 100,
  background: '#fffbeb',
  fonts: [],
  props: {
    messageText: { type: 'string', title: 'Message', default: 'Creating...', group: 'Content', maxLength: 60 },
    subText: { type: 'string', title: 'Subtitle', default: 'Design in progress', group: 'Content', maxLength: 80 },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#fffbeb', group: 'Style' },
    pencilColor: { type: 'string', title: 'Pencil colour', format: PropFormat.Color, default: '#fbbf24', group: 'Style' },
    lineColor: { type: 'string', title: 'Line colour', format: PropFormat.Color, default: '#1e293b', group: 'Style' },
    eraserColor: { type: 'string', title: 'Eraser colour', format: PropFormat.Color, default: '#fca5a5', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#1e293b', group: 'Style' },
    subColor: { type: 'string', title: 'Subtitle colour', format: PropFormat.Color, default: '#64748b', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const scale = Math.min(width, height);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const lineColor = String(p.lineColor);
    const cx = width / 2;
    const cy = height * 0.42;

    const starR = scale * 0.14;
    const innerR = scale * 0.06;
    const starPts: { x: number; y: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? starR : innerR;
      starPts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    starPts.push(starPts[0]);

    const pencilAngle = 45;
    const pencilL = scale * 0.18;
    const pAngle = (pencilAngle * Math.PI) / 180;
    const perpX = Math.cos(pAngle + Math.PI / 2) * scale * 0.016;
    const perpY = Math.sin(pAngle + Math.PI / 2) * scale * 0.016;

    const path = S.h('path', { fill: 'none', stroke: lineColor, strokeWidth: scale * 0.012, strokeLinecap: 'round', strokeLinejoin: 'round' });
    const body = S.h('polygon', { fill: String(p.pencilColor) });
    const tipShape = S.h('polygon', { fill: '#d97706' });
    const lead = S.h('polygon', { fill: lineColor });
    const eraser = S.h('rect', { fill: String(p.eraserColor) });
    const pencil = S.h('g', {}, body, tipShape, lead, eraser);
    const svg = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } }, path, pencil);
    const message = S.h('div', { style: { fontFamily: face, fontSize: scale * 0.09, fontWeight: 900, color: String(p.textColor) } }, String(p.messageText)) as HTMLElement;
    const sub = S.h('div', { style: { fontFamily: face, fontSize: scale * 0.034, fontWeight: 500, color: String(p.subColor) } }, String(p.subText)) as HTMLElement;
    const caption = S.h('div', { style: { position: 'absolute', bottom: height * 0.1, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: scale * 0.01 } }, message, sub);
    view.root.replaceChildren(S.fill({ backgroundColor: String(p.backgroundColor) }, svg, caption));

    return (frame) => {
      const drawProgress = S.interpolate(frame, [5, 72], [0, 1], { ...clamped, easing: S.Easing.inOut(S.Easing.quad) });
      const visibleLen = drawProgress * (starPts.length - 1);
      const fullIdx = Math.floor(visibleLen);
      const frac = visibleLen - fullIdx;
      const visiblePts = starPts.slice(0, fullIdx + 1);
      if (fullIdx < starPts.length - 1 && frac > 0) {
        visiblePts.push({
          x: starPts[fullIdx].x + (starPts[fullIdx + 1].x - starPts[fullIdx].x) * frac,
          y: starPts[fullIdx].y + (starPts[fullIdx + 1].y - starPts[fullIdx].y) * frac
        });
      }
      const hasPath = visiblePts.length > 1;
      path.setAttribute('d', hasPath ? `M ${visiblePts[0].x} ${visiblePts[0].y} ` + visiblePts.slice(1).map((pt) => `L ${pt.x} ${pt.y}`).join(' ') : '');
      path.setAttribute('display', hasPath ? 'inline' : 'none');

      const tip = visiblePts[visiblePts.length - 1];
      const pencilX = tip.x + Math.cos(((pencilAngle + 180) * Math.PI) / 180) * pencilL * 0.15;
      const pencilY = tip.y + Math.sin(((pencilAngle + 180) * Math.PI) / 180) * pencilL * 0.15;
      const px1 = pencilX + Math.cos(pAngle) * pencilL;
      const py1 = pencilY + Math.sin(pAngle) * pencilL;

      pencil.setAttribute('opacity', String(S.spring({ frame, fps: 30, config: { damping: 12, stiffness: 100 }, durationInFrames: 14 })));
      body.setAttribute('points', `${pencilX + perpX},${pencilY + perpY} ${pencilX - perpX},${pencilY - perpY} ${px1 - perpX},${py1 - perpY} ${px1 + perpX},${py1 + perpY}`);
      tipShape.setAttribute('points', `${pencilX + perpX * 0.6},${pencilY + perpY * 0.6} ${pencilX - perpX * 0.6},${pencilY - perpY * 0.6} ${tip.x},${tip.y}`);
      lead.setAttribute('points', `${pencilX + perpX * 0.2},${pencilY + perpY * 0.2} ${pencilX - perpX * 0.2},${pencilY - perpY * 0.2} ${tip.x},${tip.y}`);
      eraser.setAttribute('x', String(px1 - perpX - scale * 0.006));
      eraser.setAttribute('y', String(py1 - perpY - scale * 0.006));
      eraser.setAttribute('width', String(scale * 0.012 + Math.abs(perpX) * 2));
      eraser.setAttribute('height', String(scale * 0.012 + Math.abs(perpY) * 2));

      const textIn = S.spring({ frame: frame - 75, fps: 30, config: { damping: 12, stiffness: 120 }, durationInFrames: 18 });
      message.style.opacity = String(textIn);
      message.style.transform = `scale(${0.75 + textIn * 0.25})`;
      sub.style.opacity = String(S.interpolate(frame, [88, 100], [0, 1], clamped));
    };
  }
};
