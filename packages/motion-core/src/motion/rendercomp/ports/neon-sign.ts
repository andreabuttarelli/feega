import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'neon-sign',
  title: 'Neon sign',
  about: 'A framed neon sign flickers on, glows, blinks once or twice, and a small caption fades in below.',
  category: RendercompCategory.Logo,
  width: 1080,
  height: 1080,
  fps: 30,
  frames: 100,
  background: '#080010',
  fonts: [],
  props: {
    signText: { type: 'string', title: 'Sign text', default: 'OPEN', group: 'Content', maxLength: 20 },
    subText: { type: 'string', title: 'Caption', default: 'Now serving', group: 'Content', maxLength: 60 },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#080010', group: 'Style' },
    neonColor: { type: 'string', title: 'Neon colour', format: PropFormat.Color, default: '#f0abfc', group: 'Style' },
    glowColor: { type: 'string', title: 'Glow colour', format: PropFormat.Color, default: '#c026d3', group: 'Style' },
    flickerColor: { type: 'string', title: 'Flicker colour', format: PropFormat.Color, default: '#e879f9', group: 'Style' },
    frameColor: { type: 'string', title: 'Frame colour', format: PropFormat.Color, default: '#3f3f46', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#fae8ff', group: 'Style' },
    subColor: { type: 'string', title: 'Caption colour', format: PropFormat.Color, default: '#a21caf', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const glowColor = String(p.glowColor);
    const frameColor = String(p.frameColor);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const FLICKER_END = 25;
    const BLINK_FRAMES = [38, 39, 55];
    const scale = Math.min(width, height);
    const cx = width / 2;
    const cy = height * 0.42;
    const sw = scale * 0.5;
    const sh = scale * 0.2;

    const glow = S.h('div', { style: { position: 'absolute', left: '50%', top: height * 0.42, transform: 'translate(-50%, -50%)', width: sw * 1.5, height: sh * 2, borderRadius: '50%' } }) as HTMLElement;
    const sign = (fill: string, blur: number) => S.h('text', { x: cx, y: cy + sh * 0.2, textAnchor: 'middle', fontFamily: face, fontSize: scale * 0.1, fontWeight: 900, letterSpacing: scale * 0.018, fill, style: blur > 0 ? { filter: `blur(${blur}px)` } : undefined }, String(p.signText));
    const haze = sign(glowColor, scale * 0.02);
    const halo = sign(glowColor, scale * 0.008);
    const neon = sign(String(p.neonColor), 0);
    const frame = S.h('rect', { x: cx - sw / 2 - scale * 0.02, y: cy - sh / 2 - scale * 0.02, width: sw + scale * 0.04, height: sh + scale * 0.04, rx: scale * 0.02, fill: 'none', stroke: frameColor, strokeWidth: scale * 0.012 });
    const screws = [-0.46, 0.46].map((t) => S.h('circle', { cx: cx + t * sw, cy, r: scale * 0.01, fill: frameColor }));
    const svg = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } }, frame, haze, halo, neon, screws);
    const caption = S.h('div', { style: { fontFamily: face, fontSize: scale * 0.034, fontWeight: 500, color: String(p.subColor) } }, String(p.subText)) as HTMLElement;
    const captionBox = S.h('div', { style: { position: 'absolute', bottom: height * 0.1, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: scale * 0.01 } }, caption);

    view.root.replaceChildren(S.fill({ background: String(p.backgroundColor) }, glow, svg, captionBox));

    return (at) => {
      const flickering = at < FLICKER_END;
      const flickerOn = flickering ? Math.sin(at * 3.7) > -0.2 && Math.sin(at * 7.1) > -0.3 : true;
      const blink = at > FLICKER_END && BLINK_FRAMES.includes(at);
      const on = flickerOn && !blink;
      const glowOpacity = on ? 0.6 : 0;
      const frameIn = S.interpolate(at, [0, 10], [0, 1], clamped);
      const alpha = (() => { const v = Math.round(glowOpacity * 255); return '0123456789abcdef'[(v >> 4) & 15] + '0123456789abcdef'[v & 15]; })();

      glow.style.background = `radial-gradient(ellipse, ${glowColor}${alpha} 0%, transparent 70%)`;
      frame.setAttribute('opacity', String(frameIn));
      screws.forEach((screw) => screw.setAttribute('opacity', String(frameIn)));
      haze.setAttribute('opacity', String(glowOpacity * 0.4));
      halo.setAttribute('opacity', String(glowOpacity * 0.3));
      neon.setAttribute('opacity', String(on ? 1 : 0.05));
      caption.style.opacity = String(S.interpolate(at, [30, 44], [0, 1], clamped));
    };
  }
};
