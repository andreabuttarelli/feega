import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'matrix-decode',
  title: 'Matrix decode',
  about: 'Scrambled symbols resolve left to right into the final text, like a terminal decrypting.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#ffffff',
  fonts: ['Geist Mono'],
  props: {
    text: { type: 'string', title: 'Text', default: 'DECRYPTED', group: 'Content', maxLength: 120 },
    charset: { type: 'string', title: 'Charset', default: '!@#$%^&*()_+-=<>?/\\|', group: 'Content', maxLength: 120 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 160, step: 1, group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#22c55e', group: 'Style' },
    fontWeight: { type: 'string', title: 'Font weight', enum: ['400', '500', '600', '700'], default: '600', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    revealDuration: { type: 'number', title: 'Reveal duration (frames)', default: 60, minimum: 10, maximum: 240, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const speed = Number(p.speed);
    const reveal = Number(p.revealDuration);
    const text = Array.from(String(p.text));
    const charset = Array.from(String(p.charset) || '#');
    const face = S.pick(p.fontFamily, 'Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace');
    const SCRAMBLE_STEP = 2;

    const line = S.h('span', { style: { fontSize: Number(p.fontSize), fontWeight: Number(p.fontWeight), color: String(p.color), letterSpacing: '0.05em', whiteSpace: 'pre', fontFamily: face } });
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, line));

    return (at) => {
      const frame = at * speed;
      line.textContent = text
        .map((char, i) => {
          if (char === ' ' || frame >= (i / Math.max(text.length, 1)) * reveal) {
            return char;
          }
          return charset[Math.floor(S.random(`${i}-${Math.floor(frame / SCRAMBLE_STEP)}`) * charset.length)];
        })
        .join('');
    };
  }
};
