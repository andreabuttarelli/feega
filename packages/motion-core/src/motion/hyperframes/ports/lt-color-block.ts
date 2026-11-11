import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'lt-color-block',
  title: 'Lower third, colour block',
  about: 'A saturated blue block slides in from the left with a slight overshoot while the name and role rise inside it.',
  category: HfCategory.LowerThird,
  origin: HfOrigin.Block,
  source: 'lt-color-block',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 144,
  background: '#0f1115',
  fonts: ['League Gothic', 'Space Mono'],
  props: {
    person: { type: 'string', title: 'Name', default: 'Dr. Maya Chen', group: 'Content', maxLength: 60 },
    role: { type: 'string', title: 'Role', default: 'Host · Neuroscientist', group: 'Content', maxLength: 80 },
    block: { type: 'string', title: 'Block', format: PropFormat.Color, default: '#2756ff', group: 'Style' },
    nameColor: { type: 'string', title: 'Name colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    roleColor: { type: 'string', title: 'Role colour', format: PropFormat.Color, default: '#ffffffdb', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const who = S.h('div', { style: { fontFamily: "'League Gothic', sans-serif", fontSize: 84, fontWeight: 400, color: String(p.nameColor), lineHeight: 0.86, letterSpacing: '0.01em', textTransform: 'uppercase', whiteSpace: 'nowrap' } }, String(p.person)) as HTMLElement;
    const role = S.h('div', { style: { fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 400, color: String(p.roleColor), lineHeight: 1.2, letterSpacing: '0.05em', whiteSpace: 'nowrap' } }, String(p.role)) as HTMLElement;
    const block = S.h('div', { style: { background: String(p.block), padding: '20px 36px 24px 32px', boxShadow: '0 16px 44px rgba(39, 86, 255, 0.34)', display: 'inline-flex', flexDirection: 'column', gap: 8 } }, who, role) as HTMLElement;
    const wrap = S.h('div', { style: { position: 'absolute', left: 120, bottom: 116 } }, block) as HTMLElement;
    view.root.replaceChildren(wrap);

    const tl = S.timeline();
    tl.set(block, { x: -80, opacity: 0 }, 0);
    tl.set(who, { y: 24, opacity: 0 }, 0);
    tl.set(role, { y: 18, opacity: 0 }, 0);
    tl.to(block, { x: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.4)' }, 0.1);
    tl.to(who, { y: 0, opacity: 1, duration: 0.42, ease: 'power3.out' }, 0.3);
    tl.to(role, { y: 0, opacity: 1, duration: 0.42, ease: 'power3.out' }, 0.4);
    tl.to(block, { x: -60, opacity: 0, duration: 0.35, ease: 'power2.in' }, 4.3);
    tl.set(wrap, { visibility: 'hidden' }, 4.75);

    return (frame) => tl.render(frame / view.fps);
  }
};
