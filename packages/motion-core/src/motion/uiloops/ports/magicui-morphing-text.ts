import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-morphing-text',
  title: 'Morphing text',
  about: 'Words dissolve into each other through a blur and threshold filter, like liquid type.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 240,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    texts: { type: 'string', title: 'Texts (comma separated)', default: 'Hello, Morphing, Text, Animation', group: 'Content', maxLength: 300 },
    morphTime: { type: 'number', title: 'Morph time (s)', default: 1.5, minimum: 0.2, maximum: 6, step: 0.1, group: 'Motion' },
    cooldownTime: { type: 'number', title: 'Hold time (s)', default: 0.5, minimum: 0, maximum: 6, step: 0.1, group: 'Motion' },
    fontSize: { type: 'number', title: 'Font size', default: 200, minimum: 20, maximum: 400, step: 1, group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#000000', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const BLUR_BASE = 8;
    const BLUR_MAX = 100;
    const OPACITY_POWER = 0.4;
    const texts = String(p.texts).split(',').map((w) => w.trim()).filter(Boolean);
    const morph = Number(p.morphTime);
    const cool = Number(p.cooldownTime);
    const face = { position: 'absolute', left: 0, right: 0, top: 0, margin: 'auto', display: 'inline-block', width: '100%', textAlign: 'center', fontWeight: 700, lineHeight: 1, fontSize: Number(p.fontSize), color: String(p.textColor), fontFamily: S.pick(p.fontFamily, 'Inter') } as const;
    const a = S.h('span', { style: face }) as HTMLElement;
    const b = S.h('span', { style: face }) as HTMLElement;
    const filter = S.h('svg', { style: { position: 'fixed', width: 0, height: 0 } }, S.h('defs', null, S.h('filter', { id: 'threshold' }, S.h('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', values: '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 255 -140' }))));
    const stage = S.h('div', { style: { position: 'relative', width: '100%', height: Number(p.fontSize) * 1.1, filter: 'url(#threshold) blur(0.6px)' } }, a, b);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, filter, stage));

    const blurOf = (fraction: number) => `blur(${Math.min(BLUR_BASE / fraction - BLUR_BASE, BLUR_MAX)}px)`;

    return (frame) => {
      const period = morph + cool;
      const t = frame / view.fps;
      const index = Math.floor(t / period);
      const into = t - index * period;
      a.textContent = texts[index % texts.length] ?? '';
      b.textContent = texts[(index + 1) % texts.length] ?? '';
      if (into >= morph) {
        a.style.filter = 'none';
        a.style.opacity = '0';
        b.style.filter = 'none';
        b.style.opacity = '1';
        return;
      }
      const fraction = into / morph;
      b.style.filter = blurOf(fraction);
      b.style.opacity = String(Math.pow(fraction, OPACITY_POWER));
      a.style.filter = blurOf(1 - fraction);
      a.style.opacity = String(Math.pow(1 - fraction, OPACITY_POWER));
    };
  }
};
