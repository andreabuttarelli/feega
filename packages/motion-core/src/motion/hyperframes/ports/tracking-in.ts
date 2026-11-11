import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'tracking-in',
  title: 'Tracking in',
  about: 'A small label and a huge headline fade up while their wide letter-spacing tightens into place, one after the other.',
  category: HfCategory.Text,
  origin: HfOrigin.Component,
  source: 'tracking-in',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#fafafa',
  fonts: ['Inter'],
  props: {
    label: { type: 'string', title: 'Label', default: 'Editorial motion', group: 'Content', maxLength: 60 },
    headline: { type: 'string', title: 'Headline', default: 'TRACKING IN', group: 'Content', maxLength: 40 },
    tracking: { type: 'string', title: 'Tracking', default: 'standard', enum: ['tight', 'standard', 'wide'], group: 'Style' },
    rise: { type: 'string', title: 'Rise', default: 'standard', enum: ['subtle', 'standard', 'bold'], group: 'Motion' },
    tone: { type: 'string', title: 'Tone', default: 'inherit', enum: ['inherit', 'ink', 'paper', 'accent'], group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const reach = { tight: 0.6, standard: 1, wide: 1.8 }[String(p.tracking)] || 1;
    const rise = { subtle: 4, standard: 8, bold: 18 }[String(p.rise)] || 8;
    const color = { inherit: '#18181b', ink: '#18181b', paper: '#fafafa', accent: '#34d399' }[String(p.tone)] || '#18181b';
    const label = S.h('div', { style: { fontSize: 28, fontWeight: 600, textTransform: 'uppercase' } }, String(p.label)) as HTMLElement;
    const head = S.h('div', { style: { marginTop: 28, fontSize: 118, lineHeight: 1, fontWeight: 900 } }, String(p.headline)) as HTMLElement;
    const panel = S.h('div', { style: { width: 1260, textAlign: 'center', color, fontFamily: 'Inter, sans-serif' } }, label, head);
    const stage = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, panel);
    view.root.replaceChildren(stage);

    const tl = S.timeline();
    const lines = [label, head];
    tl.set(lines, { opacity: 0, y: rise, letterSpacing: 0.28 * reach + 'em' }, 0);
    tl.to(lines, { opacity: 1, y: 0, letterSpacing: 0.02 * reach + 'em', duration: 0.9, ease: 'power3.out', stagger: 0.16 }, 0.45);

    return (frame) => tl.render(frame / view.fps);
  }
};
