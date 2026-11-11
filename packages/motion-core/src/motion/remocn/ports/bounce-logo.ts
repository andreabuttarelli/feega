import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'bounce-logo',
  title: 'Bounce logo',
  about: 'A wordmark bounces off the frame edges like a screensaver, lands dead in the corner, blooms light and settles into a lockup.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 168,
  background: '#0A0A0B',
  fonts: ['Manrope', 'Instrument Serif'],
  props: {
    brand: { type: 'string', title: 'Brand', default: 'feega', group: 'Content', maxLength: 40 },
    line: { type: 'string', title: 'Line', default: 'Hit the corner.', group: 'Content', maxLength: 80 },
    theme: { type: 'string', title: 'Theme', enum: ['dark', 'light'], default: 'dark', group: 'Style' },
    accent: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#3B5BFD', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.25, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const brand = String(p.brand);
    const line = String(p.line);
    const accent = String(p.accent);
    const speed = Number(p.speed);
    const dark = p.theme !== 'light';
    const W = view.width;
    const H = view.height;
    const CORNER = 112;
    const PERIOD_X = 48.6;
    const PERIOD_Y = 47.13;
    const RESOLVE_AT = CORNER + 4;
    const RESOLVE = 22;
    const LINE_AT = CORNER + 22;
    const TRACK = -0.03;
    const CAP = 0.72;
    const ADV = [200, 329, 417, 924, 602, 901, 657, 229, 435, 435, 446, 575, 278, 420, 270, 402, 626, 406, 578, 562, 596, 580, 621, 512, 591, 621, 314, 318, 622, 750, 622, 534, 907, 646, 619, 723, 681, 575, 510, 714, 697, 249, 476, 612, 518, 846, 696, 732, 616, 732, 640, 630, 600, 708, 616, 949, 622, 574, 630, 412, 402, 412, 673, 660, 506, 562, 600, 561, 600, 590, 362, 600, 604, 249, 263, 510, 249, 865, 604, 600, 600, 600, 374, 530, 412, 604, 523, 779, 536, 538, 531, 430, 269, 430, 680];
    const DEFAULT_ADVANCE = 600;
    const THEMES = {
      dark: { bg: '#0A0A0B', fg: '#F3F2EF', line: 'rgba(243,242,239,0.78)', key: 'rgba(255,255,255,0.05)', grain: 0.07 },
      light: { bg: '#F5F4F0', fg: '#121214', line: 'rgba(18,18,20,0.72)', key: 'rgba(255,255,255,0.9)', grain: 0.045 }
    };
    const c = dark ? THEMES.dark : THEMES.light;
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const easeIO = S.Easing.bezier(0.65, 0, 0.35, 1);
    const easeOut = S.Easing.bezier(0.22, 1, 0.36, 1);
    const bloomEase = S.Easing.bezier(0.12, 0.9, 0.25, 1);
    const sans = 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif';
    const serif = "'Instrument Serif', Georgia, serif";

    const wordWidth = () => {
      let w = 0;
      for (const ch of brand) {
        const code = ch.charCodeAt(0);
        w += (code >= 32 && code < 127 ? ADV[code - 32] : DEFAULT_ADVANCE) / 1000 + TRACK;
      }
      return w - TRACK;
    };
    const fold = (v: number) => {
      const m = ((v % 2) + 2) % 2;
      return m > 1 ? 2 - m : m;
    };
    const travel = (f: number) => ({ x: 1 - (CORNER - f) / PERIOD_X, y: 1 - (CORNER - f) / PERIOD_Y });
    const hitsBefore = (f: number) => {
      const a = travel(0);
      const b = travel(Math.min(f, CORNER - 0.001));
      return Math.floor(b.x) - Math.floor(a.x) + Math.floor(b.y) - Math.floor(a.y);
    };
    const bloomGround = (r: number, drift: number) => {
      const at = `${W - drift}px ${H + drift * 0.6}px`;
      const rad = Math.max(1, r);
      if (dark) {
        return [
          `radial-gradient(${rad * 0.42}px ${rad * 0.36}px at ${at}, rgba(244,247,255,0.95) 0%, rgba(143,180,255,0.55) 45%, transparent 100%)`,
          `radial-gradient(${rad}px ${rad * 0.82}px at ${at}, rgba(143,180,255,0.9) 0%, rgba(61,91,255,0.85) 22%, rgba(26,22,96,0.75) 52%, rgba(26,22,96,0.22) 74%, transparent 100%)`
        ].join(', ');
      }
      return [
        `radial-gradient(${rad * 0.45}px ${rad * 0.38}px at ${at}, rgba(61,107,255,0.9) 0%, rgba(61,107,255,0.4) 50%, transparent 100%)`,
        `radial-gradient(${rad}px ${rad * 0.82}px at ${at}, rgba(255,79,184,0.72) 0%, rgba(255,79,184,0.5) 26%, rgba(122,60,255,0.32) 54%, rgba(122,60,255,0.08) 76%, transparent 100%)`
      ].join(', ');
    };

    const boxW = wordWidth();
    const fs = (H * 0.068) / CAP;
    const lw = boxW * fs;
    const lh = CAP * fs;
    const finalScale = Math.min(2.3, (W * 0.52) / lw);
    const lineSize = H * 0.062;
    const lineGap = lineSize * 0.95;
    const blockH = lh * finalScale + (line ? lineGap + lineSize * 0.75 : 0);
    const endX = (W - lw * finalScale) / 2;
    const endY = (H - blockH) / 2;
    const position = (f: number) => {
      const q = travel(Math.min(f, CORNER));
      return { x: fold(q.x) * (W - lw), y: fold(q.y) * (H - lh) };
    };

    const word = S.h('text', { x: 0, y: 100 * CAP, fontFamily: sans, fontWeight: 500, fontSize: 100, style: { letterSpacing: `${TRACK}em` } }, brand);
    const group = S.h('g', {}, word);
    const tagline = S.h(
      'text',
      { x: W / 2, y: endY + lh * finalScale + lineGap + lineSize * 0.75, textAnchor: 'middle', fill: c.line, opacity: 0, fontFamily: serif, fontStyle: 'italic', fontWeight: 400, fontSize: lineSize, style: { letterSpacing: '-0.01em' } },
      line
    );
    const art = S.h('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: { position: 'absolute', top: 0, left: 0 } }, group, line ? tagline : null);
    const grain = S.h(
      'svg',
      { width: '100%', height: '100%', style: { position: 'absolute', top: 0, left: 0, opacity: c.grain, pointerEvents: 'none' } },
      S.h(
        'filter',
        { id: 'bl-grain' },
        S.h('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: 2, seed: 17, stitchTiles: 'stitch' }),
        S.h('feColorMatrix', { values: '0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.9 0' })
      ),
      S.h('rect', { width: '100%', height: '100%', filter: 'url(#bl-grain)' })
    );
    const key = S.fill({ background: `radial-gradient(ellipse 70% 80% at 40% 35%, ${c.key}, transparent 70%)` });
    const ground = S.fill({ opacity: 0 }) as HTMLElement;
    view.root.replaceChildren(S.fill({ background: c.bg, overflow: 'hidden' }, key, ground, art, grain));

    return (at) => {
      const t = at * speed;
      const hits = hitsBefore(t);
      const bloom = S.interpolate(t, [CORNER, CORNER + 26], [0, 1], { ...clamp, easing: bloomEase });
      const burst = S.interpolate(t, [CORNER, CORNER + 1, CORNER + 12], [0, 1, 0], { ...clamp, easing: easeOut });
      const drift = Math.max(0, t - CORNER) * 0.35 * (H / 720);
      const resolve = S.interpolate(t, [RESOLVE_AT, RESOLVE_AT + RESOLVE], [0, 1], { ...clamp, easing: easeIO });
      const lineIn = S.interpolate(t, [LINE_AT, LINE_AT + 16], [0, 1], { ...clamp, easing: easeOut });
      const scale = 1 + (finalScale - 1) * resolve;
      const now = position(t);
      const x = now.x + (endX - now.x) * resolve;
      const y = now.y + (endY - now.y) * resolve;

      ground.style.opacity = bloom > 0 ? '1' : '0';
      ground.style.background = bloom > 0 ? bloomGround(H * (0.15 + 1.25 * bloom + 0.25 * burst), drift) : 'none';
      group.setAttribute('transform', `translate(${x} ${y}) scale(${(fs * scale) / 100})`);
      word.setAttribute('fill', t >= CORNER || hits % 2 === 0 ? c.fg : accent);
      tagline.setAttribute('opacity', String(lineIn));
      tagline.setAttribute('transform', `translate(0 ${(1 - lineIn) * lineSize * 0.5})`);
    };
  }
};
