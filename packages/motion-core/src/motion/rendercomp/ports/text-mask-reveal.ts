import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'text-mask-reveal',
  title: 'Text mask reveal',
  about: 'Each line is uncovered by an accent block that slides across and wipes away, then a rule draws under the stack.',
  category: RendercompCategory.Text,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 110,
  background: '#050818',
  fonts: [],
  props: {
    lines: { type: 'string', title: 'Lines (comma separated)', default: 'DESIGN, IN, MOTION', group: 'Content', maxLength: 200 },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#050818', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#22d3ee', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#ecfeff', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const totalFrames = 110;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const accent = String(p.accentColor);
    const entries = String(p.lines).split(',').map((l) => l.trim().toUpperCase()).filter(Boolean);
    const lineList = entries.length > 0 ? entries : ['REVEAL'];
    const count = lineList.length;
    const lineHeight = Math.round(height * 0.17);
    const fontSize = Math.round(lineHeight * 0.66);
    const stackHeight = lineHeight * count;
    const stackTop = (height - stackHeight) / 2;
    const beat = 22;
    const baseDelay = 8;
    const coverFrames = 11;
    const revealFrames = 13;
    const lastLineStart = baseDelay + (count - 1) * beat;
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const glow = S.fill({ background: `radial-gradient(circle at 18% 22%, ${S.withAlpha(accent, 0x22 / 255)} 0%, ${S.withAlpha(accent, 0)} 50%)` });
    const rule = S.h('div', { style: { position: 'absolute', left: '50%', top: stackTop + stackHeight + lineHeight * 0.18, height: Math.max(3, Math.round(height * 0.004)), transform: 'translateX(-50%)', background: `linear-gradient(90deg, ${S.withAlpha(accent, 0)}, ${accent}, ${S.withAlpha(accent, 0)})`, borderRadius: 999 } }) as HTMLElement;
    const rows = lineList.map((line, i) => {
      const text = S.h('span', { style: { fontSize, fontWeight: 800, letterSpacing: Math.round(fontSize * 0.02), lineHeight: 1, color: String(p.textColor) } }, line) as HTMLElement;
      const block = S.h('div', { style: { position: 'absolute', top: lineHeight * 0.12, bottom: lineHeight * 0.12, background: accent, borderRadius: Math.round(fontSize * 0.06), boxShadow: `0 0 ${Math.round(fontSize * 0.3)}px ${S.withAlpha(accent, 0x66 / 255)}` } }) as HTMLElement;
      S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: stackTop + i * lineHeight, height: lineHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, text, block);
      return { text, block, row: block.parentElement as HTMLElement };
    });
    const root = S.fill({ backgroundColor: String(p.backgroundColor), fontFamily: S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif'), overflow: 'hidden' }, glow, rule, ...rows.map((r) => r.row)) as HTMLElement;
    view.root.replaceChildren(root);

    return (frame) => {
      const ruleProgress = S.interpolate(frame, [lastLineStart, lastLineStart + 22], [0, 1], clamped);

      root.style.opacity = String(S.interpolate(frame, [totalFrames - 10, totalFrames], [1, 0.9], clamped));
      rule.style.width = `${Math.round(width * 0.62) * ruleProgress}px`;
      rule.style.opacity = String(0.85 * ruleProgress);

      rows.forEach(({ text, block }, i) => {
        const local = frame - (baseDelay + i * beat);
        const cover = easeInOut(S.interpolate(local, [0, coverFrames], [0, 1], clamped));
        const reveal = easeInOut(S.interpolate(local, [coverFrames, coverFrames + revealFrames], [0, 1], clamped));
        const textWipe = local < coverFrames ? 0 : reveal;
        const visiblePct = Math.round(textWipe * 100);
        const blockLeft = Math.round(reveal * 100);
        const blockRight = Math.round((1 - cover) * 100);
        const blockVisible = local >= 0 && local <= coverFrames + revealFrames + 2;

        text.style.transform = `translateY(${S.interpolate(textWipe, [0, 1], [lineHeight * 0.06, 0])}px)`;
        text.style.clipPath = `inset(0 ${100 - visiblePct}% 0 0)`;
        block.style.display = blockVisible && blockRight > blockLeft ? 'block' : 'none';
        block.style.left = `${blockLeft}%`;
        block.style.right = `${blockRight}%`;
      });
    };
  }
};
