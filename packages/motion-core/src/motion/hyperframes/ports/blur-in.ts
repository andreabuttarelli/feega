import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'blur-in',
  title: 'Blur in',
  about: 'A short line resolves word by word out of a soft blur, each word rising a few pixels into place.',
  category: HfCategory.Text,
  origin: HfOrigin.Component,
  source: 'blur-in',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#0a0a0a',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Design systems for video', group: 'Content', maxLength: 200 },
    size: { type: 'number', title: 'Size', default: 52, minimum: 24, maximum: 120, step: 2, group: 'Style' },
    tone: { type: 'string', title: 'Tone', default: 'strong', enum: ['strong', 'muted', 'accent'], group: 'Style' },
    align: { type: 'string', title: 'Align', default: 'left', enum: ['left', 'center', 'right'], group: 'Style' },
    strong: { type: 'string', title: 'Strong colour', format: PropFormat.Color, default: '#f3f3f3', group: 'Style' },
    muted: { type: 'string', title: 'Muted colour', format: PropFormat.Color, default: '#929292', group: 'Style' },
    accent: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#3ce6ac', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const size = Math.min(120, Math.max(24, Number(p.size) || 52));
    const aligns = { left: 'flex-start', center: 'center', right: 'flex-end' };
    const words = String(p.text).split(/\s+/).filter(Boolean);
    const spans = words.map((word) => S.h('span', { style: { display: 'inline-block' } }, word) as HTMLElement);
    const line = S.h('div', { style: { display: 'flex', flexWrap: 'wrap', justifyContent: aligns[String(p.align)] || aligns.left, gap: size * 0.28, maxWidth: 1728, color: String(p[String(p.tone)] || p.strong), fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: size, lineHeight: 1, letterSpacing: '-0.02em' } }, ...spans);
    const stage = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, line);
    view.root.replaceChildren(stage);

    const tl = S.timeline();
    tl.set(spans, { opacity: 0, y: 8, filter: 'blur(10px)' }, 0);
    tl.to(spans, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.36, stagger: 0.04, ease: 'power3.out' }, 0.3);

    return (frame) => tl.render(frame / view.fps);
  }
};
