import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'bottom-up-letters',
  title: 'Bottom-up letters',
  about: 'A bold headline builds letter by letter, each glyph rising from below its baseline with a small overshoot.',
  category: HfCategory.Text,
  origin: HfOrigin.Component,
  source: 'bottom-up-letters',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#16120e',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Build with motion', group: 'Content', maxLength: 120 },
    unit: { type: 'string', title: 'Split unit', default: 'letter', enum: ['letter', 'word'], group: 'Content' },
    direction: { type: 'string', title: 'Direction', default: 'up', enum: ['up', 'down'], group: 'Motion' },
    travel: { type: 'string', title: 'Travel', default: 'standard', enum: ['close', 'standard', 'far'], group: 'Motion' },
    color: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#f7ead6', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const SIZE = 180;
    const travels = { close: 0.45, standard: 0.85, far: 1.5 };
    const travel = (travels[String(p.travel)] || travels.standard) * SIZE * (p.direction === 'down' ? -1 : 1);
    const text = String(p.text);
    const parts = p.unit === 'word' ? text.split(/(\s+)/) : Array.from(text);
    const chars = [];
    const nodes = [];
    parts.forEach((part) => {
      if (part === '') {
        return;
      }
      if (p.unit === 'word' && /^\s+$/.test(part)) {
        nodes.push(document.createTextNode(part));
        return;
      }
      const span = S.h('span', { style: { display: 'inline-block' } }, part === ' ' ? ' ' : part) as HTMLElement;
      chars.push(span);
      nodes.push(span);
    });
    const line = S.h('div', { style: { display: 'inline-block', maxWidth: 1728, textAlign: 'center', color: String(p.color), fontFamily: 'Inter, sans-serif', fontSize: SIZE, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.02em' } }, ...nodes);
    const stage = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, line);
    view.root.replaceChildren(stage);

    const tl = S.timeline();
    tl.set(chars, { opacity: 0, y: travel }, 0);
    tl.to(chars, { opacity: 1, y: 0, duration: 0.48, ease: 'back.out(1.7)', stagger: 0.025 }, 0.45);

    return (frame) => tl.render(frame / view.fps);
  }
};
