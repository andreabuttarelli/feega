import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'scramble-text',
  title: 'Scramble text',
  about: 'A terminal-style label appears, then the main text decodes left to right out of random characters and finally glows. Decodes once; Hyper text repeats.',
  category: RendercompCategory.Text,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 150,
  background: '#05080f',
  fonts: [],
  props: {
    text: { type: 'string', title: 'Text', default: 'ACCESS GRANTED', group: 'Content', maxLength: 60 },
    label: { type: 'string', title: 'Label', default: 'DECRYPTING', group: 'Content', maxLength: 40 },
    charset: { type: 'string', title: 'Scramble characters', default: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+=?/<>', group: 'Content', maxLength: 120 },
    background: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#05080f', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#00ff9c', group: 'Style' },
    labelColor: { type: 'string', title: 'Label colour', format: PropFormat.Color, default: '#7a9a8c', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    scrambleDuration: { type: 'number', title: 'Scramble duration (frames)', default: 60, minimum: 1, maximum: 120, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const outCubic = S.Easing.out(S.Easing.cubic);
    const easeOut = S.Easing.out(S.Easing.ease);
    const scrambleDuration = Number(p.scrambleDuration);
    const textColor = String(p.textColor);
    const background = String(p.background);
    const label = String(p.label || '');
    const charset = String(p.charset) || 'X';
    const chars = String(p.text).split('');
    const delay = 14;
    const monoFont = '"SF Mono", "Menlo", "Consolas", monospace';

    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 9301 + 49297) * 49297;
      return x - Math.floor(x);
    };
    const lighter = (hex: string, amount: number) => {
      const clean = hex.replace('#', '');
      const channel = (from: number) => Math.max(0, Math.min(255, parseInt(clean.slice(from, from + 2), 16) + amount));
      return `#${((v: number) => [20, 16, 12, 8, 4, 0].map((sh) => '0123456789abcdef'[(v >> sh) & 15]).join(''))((channel(0) << 16) | (channel(2) << 8) | channel(4))}`;
    };

    const labelEl = S.h('div', { style: { fontFamily: monoFont, fontSize: 28, fontWeight: 500, color: String(p.labelColor), letterSpacing: 8 } }, `[ ${label} ]`) as HTMLElement;
    const scrambled = S.h('span', { style: { fontSize: 180, color: textColor, fontFamily: S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif'), fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'pre-wrap', lineBreak: 'strict', overflowWrap: 'break-word', wordBreak: 'normal' } }) as HTMLElement;
    const scan = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' } }) as HTMLElement;
    const box = S.h('div', { style: { position: 'relative', padding: '16px 48px' } }, scrambled, scan) as HTMLElement;
    view.root.replaceChildren(S.fill({ backgroundColor: background, backgroundImage: `linear-gradient(180deg, ${background} 0%, ${lighter(background, 8)} 100%), repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(0,255,156,0.02) 3px, rgba(0,255,156,0.02) 4px)`, alignItems: 'center', justifyContent: 'center', gap: 32 }, label ? labelEl : null, box));

    return (frame) => {
      const progress = S.interpolate(frame, [delay, delay + scrambleDuration], [0, 1], { ...clamped, easing: easeOut });
      const resolved = Math.floor(progress * chars.length);
      const glow = S.interpolate(frame, [scrambleDuration + 12, scrambleDuration + 24], [0, 1], { ...clamped, easing: outCubic });
      const scanY = ((frame * 6) % 200) - 100;

      labelEl.style.opacity = String(S.interpolate(frame, [0, 12], [0, 1], { ...clamped, easing: outCubic }));
      box.style.textShadow = `0 0 ${20 * glow}px ${textColor}, 0 0 ${40 * glow}px ${textColor}aa`;
      scrambled.textContent = chars.map((ch, i) => {
        if (i < resolved || ch === ' ') {
          return ch;
        }
        return charset[Math.floor(seededRandom(frame * 31 + i * 97) * charset.length)];
      }).join('');
      scan.style.background = `linear-gradient(180deg, transparent ${scanY - 4}%, ${textColor}22 ${scanY}%, transparent ${scanY + 4}%)`;
      scan.style.opacity = String(1 - glow * 0.7);
    };
  }
};
