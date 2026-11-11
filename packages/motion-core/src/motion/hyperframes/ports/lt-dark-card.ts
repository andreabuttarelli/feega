import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'lt-dark-card',
  title: 'Lower third, dark card',
  about: 'A dark card slides up from below, the name fades in, a gold underline draws across and the role fades in last.',
  category: HfCategory.LowerThird,
  origin: HfOrigin.Block,
  source: 'lt-dark-card',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 144,
  background: '#2a2d36',
  fonts: ['Montserrat'],
  props: {
    person: { type: 'string', title: 'Name', default: 'Dr. Maya Chen', group: 'Content', maxLength: 60 },
    role: { type: 'string', title: 'Role', default: 'Host · Neuroscientist', group: 'Content', maxLength: 80 },
    card: { type: 'string', title: 'Card', format: PropFormat.Color, default: '#16181d', group: 'Style' },
    accent: { type: 'string', title: 'Underline', format: PropFormat.Color, default: '#f5b942', group: 'Style' },
    nameColor: { type: 'string', title: 'Name colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    roleColor: { type: 'string', title: 'Role colour', format: PropFormat.Color, default: '#aeb6c2', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const font = 'Montserrat, sans-serif';
    const who = S.h('div', { style: { fontSize: 48, fontWeight: 700, color: String(p.nameColor), lineHeight: 1.02, letterSpacing: '-0.015em', whiteSpace: 'nowrap' } }, String(p.person)) as HTMLElement;
    const line = S.h('div', { style: { height: 4, width: '100%', background: String(p.accent), borderRadius: 2, transformOrigin: '0% 50%' } }) as HTMLElement;
    const role = S.h('div', { style: { fontSize: 25, fontWeight: 400, color: String(p.roleColor), lineHeight: 1.2, letterSpacing: '0.02em', whiteSpace: 'nowrap' } }, String(p.role)) as HTMLElement;
    const card = S.h('div', { style: { background: String(p.card), borderRadius: 14, padding: '24px 38px 26px 32px', boxShadow: '0 18px 50px rgba(0, 0, 0, 0.4)', display: 'flex', flexDirection: 'column', gap: 12 } }, who, line, role) as HTMLElement;
    const wrap = S.h('div', { style: { position: 'absolute', left: 120, bottom: 110, fontFamily: font } }, card) as HTMLElement;
    view.root.replaceChildren(wrap);

    const tl = S.timeline();
    tl.set(card, { y: 60, opacity: 0 }, 0);
    tl.set(who, { y: 14, opacity: 0 }, 0);
    tl.set(line, { scaleX: 0 }, 0);
    tl.set(role, { opacity: 0 }, 0);
    tl.to(card, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.1);
    tl.to(who, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, 0.26);
    tl.to(line, { scaleX: 1, duration: 0.5, ease: 'power4.out' }, 0.42);
    tl.to(role, { opacity: 1, duration: 0.45, ease: 'power2.out' }, 0.56);
    tl.to(card, { y: 24, opacity: 0, duration: 0.35, ease: 'power2.in' }, 4.3);
    tl.set(wrap, { visibility: 'hidden' }, 4.75);

    return (frame) => tl.render(frame / view.fps);
  }
};
