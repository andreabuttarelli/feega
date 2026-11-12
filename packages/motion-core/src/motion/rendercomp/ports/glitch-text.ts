import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'glitch-text',
  title: 'Glitch text',
  about: 'Heavy text fades in with red and cyan channel splits, horizontal tearing bands and random bursts that settle to a calmer flicker.',
  category: RendercompCategory.Text,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#0a0a0f',
  fonts: [],
  props: {
    text: { type: 'string', title: 'Text', default: 'OVERDRIVE', group: 'Content', maxLength: 40 },
    glitchColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0A0A0F', group: 'Style' },
    fontSize: { type: 'number', title: 'Font size (px)', default: 220, minimum: 20, maximum: 500, step: 1, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    intensity: { type: 'number', title: 'Intensity', default: 0.8, minimum: 0, maximum: 3, step: 0.05, group: 'Motion' },
    duration: { type: 'number', title: 'Duration (seconds)', default: 4, minimum: 0.5, maximum: 20, step: 0.1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const fps = 30;
    const fontSize = Number(p.fontSize);
    const intensity = Number(p.intensity);
    const text = String(p.text);
    const backgroundColor = String(p.backgroundColor);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const totalFrames = Math.max(1, Math.floor(Number(p.duration) * fps));
    const appearFrames = Math.floor(fps * 0.4);
    const hotFrames = Math.floor(fps * 1.2);
    const decayFrames = Math.floor(fps * 0.7);
    const residual = 0.45;
    const burstPeriod = Math.max(4, Math.floor(fps * 0.7));
    const burstLen = Math.max(2, Math.floor(fps * 0.16));
    const bands = [
      { top: -0.34 * fontSize, h: 0.13 * fontSize },
      { top: -0.1 * fontSize, h: 0.12 * fontSize },
      { top: 0.14 * fontSize, h: 0.13 * fontSize }
    ];

    const layerStyle = { position: 'absolute', fontFamily: face, fontSize, fontWeight: 900, letterSpacing: '0.04em', margin: 0, whiteSpace: 'nowrap', userSelect: 'none' };
    const makeStack = () => {
      const red = S.h('span', { style: { ...layerStyle, color: '#FF0033', mixBlendMode: 'screen' } }, text) as HTMLElement;
      const blue = S.h('span', { style: { ...layerStyle, color: '#00E0FF', mixBlendMode: 'screen' } }, text) as HTMLElement;
      const main = S.h('span', { style: { ...layerStyle, color: String(p.glitchColor), position: 'relative' } }, text) as HTMLElement;
      const box = S.h('div', { style: { position: 'relative' } }, red, blue, main) as HTMLElement;
      return { box, red, blue, main };
    };
    const place = (stack: ReturnType<typeof makeStack>, shiftX: number, r: number[], b: number[]) => {
      stack.box.style.transform = `translateX(${shiftX}px)`;
      stack.red.style.transform = `translate(${r[0]}px, ${r[1]}px)`;
      stack.blue.style.transform = `translate(${b[0]}px, ${b[1]}px)`;
      stack.main.style.textShadow = `${r[0] * 0.3}px 0 0 #FF003366, ${b[0] * 0.3}px 0 0 #00E0FF66`;
    };

    const centre = { alignItems: 'center', justifyContent: 'center' };
    const mainStack = makeStack();
    const tears = bands.map((band) => {
      const stack = makeStack();
      const layer = S.fill({ ...centre, backgroundColor, clipPath: `inset(calc(50% + ${band.top}px) 0 calc(50% - ${band.top + band.h}px) 0)` }, stack.box) as HTMLElement;
      return { stack, layer };
    });
    const root = S.fill({ backgroundColor }, S.fill(centre, mainStack.box), ...tears.map((t) => t.layer)) as HTMLElement;
    view.root.replaceChildren(root);

    return (frame) => {
      const opacity = S.interpolate(frame, [0, appearFrames], [0, 1], clamped);
      const baseAmount = frame < hotFrames ? 1 : S.interpolate(frame, [hotFrames, hotFrames + decayFrames], [1, residual], clamped);
      const burstIndex = Math.floor(frame / burstPeriod);
      const intoBurst = frame - burstIndex * burstPeriod;
      const burstFiring = intoBurst < burstLen && S.random(`burst-${burstIndex}`) > 0.3;
      const phase = burstFiring ? Math.max(baseAmount, 1) : baseAmount;
      const tearing = phase > 0.75;
      const fadeOut = S.interpolate(frame, [totalFrames - Math.floor(fps * 0.3), totalFrames], [1, 0], clamped);
      const seed = Math.floor(frame / (burstFiring ? 2 : 3));
      const maxOffset = 18 * intensity * phase;
      const signed = (key: string) => (S.random(key) - 0.5) * 2;
      const r = [signed(`r-x-${seed}`) * maxOffset, signed(`r-y-${seed}`) * (maxOffset * 0.4)];
      const b = [signed(`b-x-${seed}`) * maxOffset, signed(`b-y-${seed}`) * (maxOffset * 0.4)];
      const sliceShift = signed(`slice-${seed}`) * (8 * intensity * phase);

      root.style.opacity = String(opacity * fadeOut);
      place(mainStack, sliceShift, r, b);

      tears.forEach((tear, i) => {
        tear.layer.style.display = tearing ? 'flex' : 'none';
        place(tear.stack, sliceShift + signed(`tear-${i}-${seed}`) * maxOffset * 2.4, r, b);
      });
    };
  }
};
