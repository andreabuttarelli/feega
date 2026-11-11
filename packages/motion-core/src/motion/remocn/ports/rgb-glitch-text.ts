import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'rgb-glitch-text',
  title: 'RGB glitch text',
  about: 'Red, green and blue copies of the text jitter apart for a brief chromatic glitch.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#fafafa',
  fonts: ['Geist'],
  props: {
    text: { type: 'string', title: 'Text', default: 'GLITCH', group: 'Content', maxLength: 120 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 96, minimum: 12, maximum: 200, step: 1, group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    fontWeight: { type: 'string', title: 'Font weight', enum: ['400', '500', '600', '700'], default: '700', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    glitchAt: { type: 'number', title: 'Glitch at (frame)', default: 20, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    glitchDuration: { type: 'number', title: 'Glitch duration (frames)', default: 8, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    intensity: { type: 'number', title: 'Intensity (px)', default: 6, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    seed: { type: 'string', title: 'Seed', default: 'glitch', group: 'Motion', maxLength: 40 },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const glitchAt = Number(p.glitchAt);
    const glitchEnd = glitchAt + Number(p.glitchDuration);
    const intensity = Number(p.intensity);
    const seed = String(p.seed);
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const VERTICAL_RATIO = 0.4;
    const CHANNELS = [
      { key: 'r', color: '#ff0040' },
      { key: 'g', color: '#00ff80' },
      { key: 'b', color: '#0080ff' }
    ];
    const font = { fontSize: Number(p.fontSize), fontWeight: Number(p.fontWeight), letterSpacing: '-0.03em', fontFamily: face, whiteSpace: 'pre' };

    const base = S.h('span', { style: { ...font, position: 'relative', color: String(p.color) } }, String(p.text));
    const copies = CHANNELS.map((channel) => S.h('span', { style: { ...font, position: 'absolute', top: 0, left: 0, color: channel.color, opacity: 0, mixBlendMode: 'multiply' } }, String(p.text)) as HTMLElement);
    const box = S.h('div', { style: { position: 'relative', display: 'inline-block' } }, [base, ...copies]);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, box));

    return (at) => {
      const frame = at * speed;
      const glitching = frame >= glitchAt && frame < glitchEnd;
      const offset = (axis: string, scale: number) => (S.random(`${seed}-${axis}-${frame}`) * 2 - 1) * scale;
      copies.forEach((el, i) => {
        const key = CHANNELS[i].key;
        const x = glitching ? offset(`${key}-x`, intensity) : 0;
        const y = glitching ? offset(`${key}-y`, intensity * VERTICAL_RATIO) : 0;
        el.style.opacity = glitching ? '1' : '0';
        el.style.translate = `${x}px ${y}px`;
      });
    };
  }
};
