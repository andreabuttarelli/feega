import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'lt-soft-pill',
  title: 'Lower third, soft pill',
  about: 'A white pill scales up from the lower left with a bounce, a coloured dot pops in and the name and role settle in.',
  category: HfCategory.LowerThird,
  origin: HfOrigin.Block,
  source: 'lt-soft-pill',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 144,
  background: '#0f1115',
  fonts: ['Montserrat'],
  props: {
    person: { type: 'string', title: 'Name', default: 'Dr. Maya Chen', group: 'Content', maxLength: 60 },
    role: { type: 'string', title: 'Role', default: 'Host · Neuroscientist', group: 'Content', maxLength: 80 },
    accent: { type: 'string', title: 'Dot', format: PropFormat.Color, default: '#ff5a36', group: 'Style' },
    pill: { type: 'string', title: 'Pill', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    nameColor: { type: 'string', title: 'Name colour', format: PropFormat.Color, default: '#0f1115', group: 'Style' },
    roleColor: { type: 'string', title: 'Role colour', format: PropFormat.Color, default: '#5a6170', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const dot = S.h('div', { style: { width: 18, height: 18, borderRadius: '50%', background: String(p.accent), flexShrink: 0 } }) as HTMLElement;
    const who = S.h('div', { style: { fontSize: 46, fontWeight: 700, color: String(p.nameColor), lineHeight: 1.04, letterSpacing: '-0.015em', whiteSpace: 'nowrap' } }, String(p.person)) as HTMLElement;
    const role = S.h('div', { style: { fontSize: 25, fontWeight: 400, color: String(p.roleColor), lineHeight: 1.2, letterSpacing: '0.01em', whiteSpace: 'nowrap' } }, String(p.role)) as HTMLElement;
    const text = S.h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } }, who, role);
    const pill = S.h('div', { style: { display: 'flex', alignItems: 'center', gap: 22, background: String(p.pill), borderRadius: 999, padding: '20px 40px 20px 26px', boxShadow: '0 16px 46px rgba(15, 17, 21, 0.2)', transformOrigin: '0% 100%' } }, dot, text) as HTMLElement;
    const wrap = S.h('div', { style: { position: 'absolute', left: 120, bottom: 120, fontFamily: 'Montserrat, sans-serif' } }, pill) as HTMLElement;
    view.root.replaceChildren(wrap);

    const tl = S.timeline();
    tl.set(pill, { scale: 0.88, y: 18, opacity: 0 }, 0);
    tl.set(dot, { scale: 0 }, 0);
    tl.set([who, role], { opacity: 0, x: -10 }, 0);
    tl.to(pill, { scale: 1, y: 0, opacity: 1, duration: 0.55, ease: 'back.out(1.7)' }, 0.1);
    tl.to(dot, { scale: 1, duration: 0.4, ease: 'back.out(3)' }, 0.4);
    tl.to(who, { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out' }, 0.42);
    tl.to(role, { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out' }, 0.5);
    tl.to(pill, { scale: 0.94, y: 14, opacity: 0, duration: 0.35, ease: 'power2.in' }, 4.3);
    tl.set(wrap, { visibility: 'hidden' }, 4.75);

    return (frame) => tl.render(frame / view.fps);
  }
};
