import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'particle-snow',
  title: 'Particle snow',
  about: 'Snowflakes fall in three depth layers under a faint night sky of twinkling stars while a title fades in.',
  category: RendercompCategory.Loop,
  width: 1080,
  height: 1080,
  fps: 30,
  frames: 150,
  background: '#0f172a',
  fonts: [],
  props: {
    title: { type: 'string', title: 'Title', default: 'Winter Magic', group: 'Content', maxLength: 60 },
    subtitle: { type: 'string', title: 'Subtitle', default: "Season's Greetings", group: 'Content', maxLength: 80 },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0f172a', group: 'Style' },
    snowColor: { type: 'string', title: 'Snow colour', format: PropFormat.Color, default: '#e2e8f0', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#38bdf8', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#f8fafc', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    flakeCount: { type: 'number', title: 'Snowflakes', default: 70, minimum: 3, maximum: 300, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const scale = Math.min(width, height);
    const flakeCount = Math.round(Number(p.flakeCount));
    const snowColor = String(p.snowColor);
    const accentColor = String(p.accentColor);
    const subtitle = String(p.subtitle);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');

    const flakes = Array.from({ length: flakeCount }, (_, i) => {
      const r1 = Math.abs(Math.sin(i * 1.6180339887));
      const r2 = Math.abs(Math.sin(i * 2.7182818284));
      const r3 = Math.abs(Math.sin(i * 3.1415926535));
      const layer = i % 3;
      return {
        xNorm: r1,
        size: layer === 0 ? 2 + r2 * 2 : layer === 1 ? 3 + r2 * 3 : 4 + r2 * 4,
        speed: layer === 0 ? 0.7 + r3 * 0.5 : layer === 1 ? 1.1 + r3 * 0.7 : 1.5 + r3 * 0.9,
        swayAmp: (r2 - 0.5) * 0.06,
        swayFreq: 0.025 + r3 * 0.04,
        phase: r1 * Math.PI * 2,
        layer,
        opacity: layer === 0 ? 0.25 + r2 * 0.2 : layer === 1 ? 0.45 + r2 * 0.2 : 0.65 + r2 * 0.3,
        startY: -(r3 * height)
      };
    });
    const ordered = [0, 1, 2].flatMap((layer) => flakes.filter((f) => f.layer === layer));
    const flakeEls = ordered.map((f) => S.h('circle', { r: f.size, fill: snowColor, opacity: f.opacity }));

    const starCount = 40;
    const starEls = Array.from({ length: starCount }, (_, i) => S.h('circle', {
      cx: Math.abs(Math.sin(i * 7.3)) * width,
      cy: Math.abs(Math.sin(i * 5.1)) * height * 0.6,
      r: Math.abs(Math.sin(i * 3.7)) * 1.5 + 0.5,
      fill: snowColor
    }));

    const sky = S.h('linearGradient', { id: 'snow-sky', x1: '0', y1: '0', x2: '0', y2: '1' },
      S.h('stop', { offset: '0%', stopColor: accentColor, stopOpacity: '0.12' }),
      S.h('stop', { offset: '100%', stopColor: accentColor, stopOpacity: '0' })
    );
    const svg = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } },
      S.h('defs', {}, sky),
      S.h('rect', { width, height, fill: 'url(#snow-sky)' }),
      ...starEls,
      ...flakeEls
    );

    const heading = S.h('div', { style: { fontFamily: face, fontSize: scale * 0.085, fontWeight: 800, color: String(p.textColor), textShadow: `0 0 30px ${accentColor}88`, letterSpacing: -1 } }, String(p.title));
    const sub = subtitle ? S.h('div', { style: { fontFamily: face, fontSize: scale * 0.034, fontWeight: 400, color: String(p.textColor), opacity: 0.65, letterSpacing: 1 } }, subtitle) : null;
    const caption = S.h('div', { style: { position: 'absolute', bottom: height * 0.14, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: scale * 0.012 } }, heading, sub) as HTMLElement;
    view.root.replaceChildren(S.fill({ backgroundColor: String(p.backgroundColor) }, svg, caption));

    return (frame) => {
      svg.style.opacity = String(S.interpolate(frame, [0, 25], [0, 1], clamped));

      starEls.forEach((star, i) => {
        star.setAttribute('opacity', String(0.3 + Math.abs(Math.sin(i * 2.3 + frame * 0.05)) * 0.4));
      });

      ordered.forEach((flake, i) => {
        const totalDist = height + flake.size * 2;
        const rawY = flake.startY + frame * flake.speed + flake.phase * (height / (Math.PI * 2));
        const el = flakeEls[i];
        el.setAttribute('cy', String(((rawY % totalDist) + totalDist) % totalDist));
        el.setAttribute('cx', String(flake.xNorm * width + Math.sin(frame * flake.swayFreq + flake.phase) * flake.swayAmp * width));
      });

      const textIn = S.interpolate(frame, [30, 55], [0, 1], clamped);
      caption.style.opacity = String(textIn);
      caption.style.transform = `translateY(${S.interpolate(textIn, [0, 1], [20, 0])}px)`;
    };
  }
};
