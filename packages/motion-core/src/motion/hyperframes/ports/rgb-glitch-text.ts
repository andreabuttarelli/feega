import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'rgb-glitch-text',
  title: 'RGB glitch text',
  about: 'A bold word flickers with red and cyan ghost copies tearing sideways in hard steps, then settles.',
  category: HfCategory.Text,
  origin: HfOrigin.Component,
  source: 'rgb-glitch-text',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 150,
  background: '#09090b',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'GLITCH', group: 'Content', maxLength: 24 },
    intensity: { type: 'string', title: 'Intensity', default: 'standard', enum: ['subtle', 'standard', 'extreme'], group: 'Motion' },
    color: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#fafafa', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const reach = { subtle: 0.5, standard: 1, extreme: 2.25 }[String(p.intensity)] || 1;
    const text = String(p.text).trim() || 'GLITCH';
    const layer = (color, blend) => ({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, color, mixBlendMode: blend });
    const red = S.h('span', { style: layer('#ef4444', 'screen') }, text) as HTMLElement;
    const cyan = S.h('span', { style: layer('#22d3ee', 'screen') }, text) as HTMLElement;
    const solid = S.h('strong', { style: layer(String(p.color), undefined) }, text);
    const word = S.h('div', { style: { position: 'relative', width: 1120, height: 200, fontFamily: 'Inter, sans-serif', fontSize: 192, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, textAlign: 'center' } }, red, cyan, solid);
    const stage = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, word);
    view.root.replaceChildren(stage);

    const START = 0.5;
    const TEAR = 20 * reach;
    const tl = S.timeline();
    tl.set(red, { x: 0 }, 0);
    tl.set(cyan, { x: 0 }, 0);
    tl.to(red, { x: -TEAR, duration: 0.06, repeat: 5, yoyo: true, ease: 'steps(1)' }, START + 0.1);
    tl.to(cyan, { x: TEAR, duration: 0.06, repeat: 5, yoyo: true, ease: 'steps(1)' }, START + 0.1);

    return (frame) => tl.render(frame / view.fps);
  }
};
