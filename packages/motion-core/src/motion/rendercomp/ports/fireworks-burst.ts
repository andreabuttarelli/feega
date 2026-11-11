import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'fireworks-burst',
  title: 'Fireworks burst',
  about: 'Three fireworks shoot up and burst in coloured petals, then a message springs in with a subtitle below.',
  category: RendercompCategory.Loop,
  width: 1080,
  height: 1080,
  fps: 30,
  frames: 110,
  background: '#0f172a',
  fonts: [],
  props: {
    messageText: { type: 'string', title: 'Message', default: 'Boom!', group: 'Content', maxLength: 60 },
    subText: { type: 'string', title: 'Subtitle', default: 'Celebration time', group: 'Content', maxLength: 80 },
    burstColors: { type: 'string', title: 'Burst colours (comma separated)', default: '#ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ec4899', group: 'Style', maxLength: 300 },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0f172a', group: 'Style' },
    trailColor: { type: 'string', title: 'Trail colour', format: PropFormat.Color, default: '#fef08a', group: 'Style' },
    sparkColor: { type: 'string', title: 'Spark colour', format: PropFormat.Color, default: '#fbbf24', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#f8fafc', group: 'Style' },
    subColor: { type: 'string', title: 'Subtitle colour', format: PropFormat.Color, default: '#fbbf24', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const scale = Math.min(width, height);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const parsed = String(p.burstColors).split(',').map((c) => c.trim()).filter(Boolean);
    const burstColors = parsed.length ? parsed : ['#ef4444'];
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const trailColor = String(p.trailColor);
    const sparkColor = String(p.sparkColor);

    const cx = width / 2;
    const cy = height * 0.42;
    const bursts = [
      { startFrame: 0, x: cx, y: cy, colorOffset: 0 },
      { startFrame: 20, x: cx - scale * 0.18, y: cy + scale * 0.05, colorOffset: 3 },
      { startFrame: 35, x: cx + scale * 0.18, y: cy - scale * 0.03, colorOffset: 5 }
    ];
    const numPetals = 12;
    const numSparks = 8;

    const parts = bursts.map((burst) => {
      const trail = S.h('line', { x1: burst.x, y1: burst.y + scale * 0.15, x2: burst.x, y2: burst.y + scale * 0.01, stroke: trailColor, strokeWidth: scale * 0.006, strokeLinecap: 'round' });
      const petals = Array.from({ length: numPetals }, (_, i) => {
        const color = burstColors[(i + burst.colorOffset) % burstColors.length];
        return {
          line: S.h('line', { stroke: color, strokeWidth: scale * 0.007, strokeLinecap: 'round' }),
          dot: S.h('circle', { fill: color })
        };
      });
      const sparks = Array.from({ length: numSparks }, () => S.h('circle', { r: scale * 0.006, fill: sparkColor, opacity: 0.7 }));
      const group = S.h('g', {}, trail, ...petals.flatMap((pt) => [pt.line, pt.dot]), ...sparks);
      return { burst, group, trail, petals, sparks };
    });

    const svg = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } }, ...parts.map((pt) => pt.group));
    const message = S.h('div', { style: { fontFamily: face, fontSize: scale * 0.09, fontWeight: 900, color: String(p.textColor) } }, String(p.messageText)) as HTMLElement;
    const sub = S.h('div', { style: { fontFamily: face, fontSize: scale * 0.034, fontWeight: 500, color: String(p.subColor) } }, String(p.subText)) as HTMLElement;
    const caption = S.h('div', { style: { position: 'absolute', bottom: height * 0.1, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: scale * 0.01 } }, message, sub);
    view.root.replaceChildren(S.fill({ backgroundColor: String(p.backgroundColor) }, svg, caption));

    return (frame) => {
      const textIn = S.spring({ frame: frame - 68, fps: 30, config: { damping: 12, stiffness: 120 }, durationInFrames: 18 });
      message.style.opacity = String(textIn);
      message.style.transform = `scale(${0.75 + textIn * 0.25})`;
      sub.style.opacity = String(S.interpolate(frame, [82, 96], [0, 1], clamped));

      parts.forEach(({ burst, group, trail, petals, sparks }) => {
        const localFrame = frame - burst.startFrame;
        const fadeOut = localFrame > 50 ? Math.max(0, 1 - (localFrame - 50) / 30) : 1;
        group.setAttribute('display', localFrame < 0 || fadeOut <= 0 ? 'none' : 'inline');
        if (localFrame < 0 || fadeOut <= 0) {
          return;
        }

        const burstProgress = Math.min(1, localFrame / 30);
        const radius = scale * 0.14 * burstProgress;
        group.setAttribute('opacity', String(fadeOut));
        trail.setAttribute('display', localFrame < 15 ? 'inline' : 'none');
        trail.setAttribute('opacity', String(1 - localFrame / 15));

        petals.forEach((petal, i) => {
          const angle = (i / numPetals) * Math.PI * 2;
          const px = burst.x + Math.cos(angle) * radius;
          const py = burst.y + Math.sin(angle) * radius;
          petal.line.setAttribute('x1', String(burst.x + Math.cos(angle) * radius * 0.4));
          petal.line.setAttribute('y1', String(burst.y + Math.sin(angle) * radius * 0.4));
          petal.line.setAttribute('x2', String(px));
          petal.line.setAttribute('y2', String(py));
          petal.dot.setAttribute('cx', String(px));
          petal.dot.setAttribute('cy', String(py));
          petal.dot.setAttribute('r', String(scale * 0.012 * (1 - burstProgress * 0.4)));
        });

        sparks.forEach((spark, i) => {
          const angle = (i / numSparks) * Math.PI * 2 + 0.2;
          spark.setAttribute('cx', String(burst.x + Math.cos(angle) * radius * 1.2));
          spark.setAttribute('cy', String(burst.y + Math.sin(angle) * radius * 1.2));
        });
      });
    };
  }
};
