import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'wave-text',
  title: 'Wave text',
  about: 'Each letter of a big word rides a travelling sine wave on a soft gradient, with a spaced subtitle sliding in underneath.',
  category: RendercompCategory.Text,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 150,
  background: '#0c2342',
  fonts: [],
  props: {
    text: { type: 'string', title: 'Text', default: 'WAVE', group: 'Content', maxLength: 40 },
    subText: { type: 'string', title: 'Subtitle', default: 'Shape the Future', group: 'Content', maxLength: 80 },
    background: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0c2342', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    subTextColor: { type: 'string', title: 'Subtitle colour', format: PropFormat.Color, default: '#7fb3ff', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    amplitude: { type: 'number', title: 'Amplitude (px)', default: 18, minimum: 0, maximum: 100, step: 1, group: 'Motion' },
    waveSpeed: { type: 'number', title: 'Wave period (frames)', default: 28, minimum: 4, maximum: 120, step: 1, group: 'Motion' },
    wavelength: { type: 'number', title: 'Phase step per letter', default: 0.55, minimum: 0, maximum: 3, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const outCubic = S.Easing.out(S.Easing.cubic);
    const outEase = S.Easing.out(S.Easing.ease);
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const amplitude = Number(p.amplitude);
    const waveSpeed = Number(p.waveSpeed);
    const wavelength = Number(p.wavelength);
    const background = String(p.background);
    const subText = String(p.subText || '');
    const fadeDuration = 18;

    const shade = (hex: string, percent: number) => {
      const num = parseInt(hex.replace('#', ''), 16);
      const channel = (shift: number) => Math.max(0, Math.min(255, ((num >> shift) & 0xff) + Math.round((percent / 100) * 255)));
      return `#${((v: number) => [20, 16, 12, 8, 4, 0].map((sh) => '0123456789abcdef'[(v >> sh) & 15]).join(''))((channel(16) << 16) | (channel(8) << 8) | channel(0))}`;
    };

    const letters = String(p.text).split('').map((char) => S.h('span', { style: { display: 'inline-block', whiteSpace: char === ' ' ? 'pre' : undefined } }, char) as HTMLElement);
    const word = S.h('span', { style: { display: 'inline-flex', fontSize: 140, fontFamily: face, fontWeight: 700, color: String(p.textColor) } }, ...letters) as HTMLElement;
    const sub = S.h('div', { style: { fontFamily: face, fontSize: 40, fontWeight: 500, color: String(p.subTextColor), letterSpacing: 6 } }, subText) as HTMLElement;
    view.root.replaceChildren(S.fill({ background: `linear-gradient(180deg, ${background} 0%, ${shade(background, -15)} 100%)`, alignItems: 'center', justifyContent: 'center', gap: 36 }, word, subText ? sub : null));

    return (frame) => {
      const fadeIn = S.interpolate(frame, [0, fadeDuration], [0, 1], { ...clamped, easing: outEase });
      const phase = (frame / waveSpeed) * Math.PI * 2;

      word.style.opacity = String(fadeIn);
      letters.forEach((letter, i) => {
        letter.style.transform = `translateY(${Math.sin(phase + i * wavelength) * amplitude * fadeIn}px)`;
      });

      sub.style.opacity = String(S.interpolate(frame, [24, 40], [0, 1], { ...clamped, easing: outCubic }));
      sub.style.transform = `translateY(${S.interpolate(frame, [24, 40], [16, 0], { ...clamped, easing: outCubic })}px)`;
    };
  }
};
