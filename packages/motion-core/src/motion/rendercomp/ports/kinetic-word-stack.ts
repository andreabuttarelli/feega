import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'kinetic-word-stack',
  title: 'Kinetic word stack',
  about: 'Words drop into a centred vertical stack one beat at a time, the last one lights up in the accent colour while a guide line draws through them.',
  category: RendercompCategory.Text,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#050818',
  fonts: [],
  props: {
    words: { type: 'string', title: 'Words (comma separated)', default: 'BUILD, WHAT, MATTERS, NOW', group: 'Content', maxLength: 200 },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#050818', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#22d3ee', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#ecfeff', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const fps = 30;
    const totalFrames = 120;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const accent = String(p.accentColor);
    const entries = String(p.words).split(',').map((w) => w.trim().toUpperCase()).filter(Boolean);
    const wordList = entries.length > 0 ? entries : ['BUILD'];
    const count = wordList.length;
    const lastIndex = count - 1;
    const lineHeight = Math.round(height * 0.155);
    const fontSize = Math.round(lineHeight * 0.74);
    const stackTop = (height - lineHeight * count) / 2;
    const beat = 11;
    const baseDelay = 6;

    const glow = S.fill({ background: `radial-gradient(circle at 50% 50%, ${S.withAlpha(accent, 0x22 / 255)} 0%, ${S.withAlpha(accent, 0)} 55%)` });
    const guide = S.h('div', { style: { position: 'absolute', left: '50%', top: stackTop + lineHeight * 0.5, width: Math.max(2, Math.round(width * 0.0015)), transform: 'translateX(-50%)', background: `linear-gradient(180deg, ${S.withAlpha(accent, 0)}, ${accent}, ${S.withAlpha(accent, 0)})`, borderRadius: 999 } }) as HTMLElement;
    const rows = wordList.map((word, i) => {
      const label = S.h('span', { style: { fontSize, fontWeight: 800, letterSpacing: Math.round(fontSize * 0.02), lineHeight: 1, color: i === lastIndex ? accent : String(p.textColor) } }, word) as HTMLElement;
      const row = S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: stackTop + i * lineHeight, height: lineHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, label) as HTMLElement;
      return { row, label };
    });
    const root = S.fill({ backgroundColor: String(p.backgroundColor), fontFamily: S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif'), overflow: 'hidden' }, glow, guide, ...rows.map((r) => r.row)) as HTMLElement;
    view.root.replaceChildren(root);

    return (frame) => {
      const settle = S.spring({ frame: frame - (baseDelay + lastIndex * beat + 6), fps, config: { damping: 18, stiffness: 90 }, durationInFrames: 24 });

      root.style.opacity = String(S.interpolate(frame, [totalFrames - 12, totalFrames], [1, 0.92], clamped));
      glow.style.opacity = String(0.4 + settle * 0.6);
      guide.style.height = `${lineHeight * (count - 1) * settle}px`;
      guide.style.opacity = String(0.55 * settle);

      rows.forEach(({ row, label }, i) => {
        const local = frame - (baseDelay + i * beat);
        const drop = S.spring({ frame: local, fps, config: { damping: 13, stiffness: 170, mass: 0.7 }, durationInFrames: 22 });
        const flash = S.interpolate(local, [16, 22, 30], [0, 1, 0], clamped);
        const isAccent = i === lastIndex;

        row.style.opacity = String(S.interpolate(drop, [0, 0.25, 1], [0, 1, 1], clamped));
        row.style.transform = `translateY(${S.interpolate(drop, [0, 1], [-lineHeight * 1.1, 0])}px) scale(${S.interpolate(drop, [0, 1], [1.18, 1])})`;
        label.style.textShadow = isAccent
          ? `0 0 ${Math.round(fontSize * (0.18 + flash * 0.35))}px ${S.withAlpha(accent, 0xcc / 255)}`
          : `0 0 ${Math.round(fontSize * flash * 0.22)}px ${S.withAlpha(accent, 0x66 / 255)}`;
      });
    };
  }
};
