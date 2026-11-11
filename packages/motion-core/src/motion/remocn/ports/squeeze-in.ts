import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'squeeze-in',
  title: 'Squeeze in',
  about: 'Letters wipe in left to right with loose spacing, then tighten into the final word.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 60,
  background: '#ffffff',
  fonts: ['Geist'],
  props: {
    text: { type: 'string', title: 'Text', default: 'feega', group: 'Content', maxLength: 60 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 160, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 400, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    stagger: { type: 'number', title: 'Frames / char', default: 3, minimum: 1, maximum: 8, step: 1, group: 'Motion' },
    squeeze: { type: 'number', title: 'Extra gap (em)', default: 0.03, minimum: 0, maximum: 0.2, step: 0.01, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const fontSize = Number(p.fontSize);
    const squeeze = Number(p.squeeze);
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const SQUEEZE_FRAMES = 16;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const chars = Array.from(String(p.text));
    const lastReveal = chars.length * Number(p.stagger);

    const letters = chars.map((char) => S.h('span', { style: { display: 'inline-block', whiteSpace: 'pre' } }, char) as HTMLElement);
    const word = S.h('span', { style: { fontSize, fontWeight: Number(p.fontWeight), color: String(p.color), letterSpacing: '-0.02em', lineHeight: 1.1, fontFamily: face } }, letters) as HTMLElement;
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }, word));

    return (at) => {
      const frame = at * speed;
      const tighten = S.interpolate(frame, [lastReveal, lastReveal + SQUEEZE_FRAMES], [0, 1], { ...clamped, easing: S.Easing.out(S.Easing.cubic) });
      const gap = squeeze * fontSize * (1 - tighten);
      const wipe = S.interpolate(frame, [0, lastReveal], [100, 0], clamped);

      word.style.translate = `${(-squeeze * fontSize * tighten * (chars.length - 1)) / 2}px 0`;
      word.style.clipPath = `inset(-0.2em ${wipe}% -0.25em -0.1em)`;
      letters.forEach((el, i) => {
        el.style.marginRight = i < letters.length - 1 ? `${gap}px` : '';
      });
    };
  }
};
