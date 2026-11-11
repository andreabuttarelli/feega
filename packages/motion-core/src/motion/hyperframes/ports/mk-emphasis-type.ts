import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'mk-emphasis-type',
  title: 'Emphasis type',
  about: 'A huge, faint word fades in and drifts slowly sideways behind the scene, then fades out.',
  category: HfCategory.Title,
  origin: HfOrigin.Component,
  source: 'mk-emphasis-type',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#f5f5f7',
  fonts: ['Inter'],
  props: {
    word: { type: 'string', title: 'Word', default: 'Emphasis', group: 'Content', maxLength: 24 },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: 'rgba(29, 29, 31, 0.07)', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const word = S.h('div', { style: { position: 'absolute', top: 400, left: -40, fontFamily: 'Inter, -apple-system, sans-serif', fontWeight: 600, fontSize: 260, letterSpacing: '-0.02em', lineHeight: 1, whiteSpace: 'nowrap', textTransform: 'uppercase', color: String(p.color) } }, String(p.word)) as HTMLElement;
    view.root.replaceChildren(word);

    const tl = S.timeline();
    tl.set(word, { opacity: 0, x: 40 }, 0);
    tl.to(word, { opacity: 1, duration: 1.0, ease: 'power2.out' }, 0.3);
    tl.to(word, { x: -70, duration: 3.2, ease: 'sine.inOut' }, 0.3);
    tl.to(word, { opacity: 0, duration: 0.5, ease: 'power2.in' }, 3.4);

    return (frame) => tl.render(frame / view.fps);
  }
};
