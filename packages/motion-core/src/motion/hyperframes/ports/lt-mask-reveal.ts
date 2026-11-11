import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'lt-mask-reveal',
  title: 'Lower third, mask reveal',
  about: 'A yellow sweep bar crosses left to right and the heavy name is wiped into view behind it, then the role fades up.',
  category: HfCategory.LowerThird,
  origin: HfOrigin.Block,
  source: 'lt-mask-reveal',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 144,
  background: '#0f1115',
  fonts: ['Montserrat'],
  props: {
    person: { type: 'string', title: 'Name', default: 'Dr. Maya Chen', group: 'Content', maxLength: 60 },
    role: { type: 'string', title: 'Role', default: 'Host · Neuroscientist', group: 'Content', maxLength: 80 },
    accent: { type: 'string', title: 'Sweep', format: PropFormat.Color, default: '#ffd23f', group: 'Style' },
    nameColor: { type: 'string', title: 'Name colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    roleColor: { type: 'string', title: 'Role colour', format: PropFormat.Color, default: '#e7eaf0', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const who = S.h('div', { style: { fontSize: 72, fontWeight: 900, color: String(p.nameColor), lineHeight: 0.98, letterSpacing: '-0.02em', whiteSpace: 'nowrap', textShadow: '0 2px 22px rgba(0, 0, 0, 0.45)' } }, String(p.person)) as HTMLElement;
    const sweep = S.h('div', { style: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 8, background: String(p.accent) } }) as HTMLElement;
    const nameWrap = S.h('div', { style: { position: 'relative', overflow: 'hidden', padding: '2px 0' } }, who, sweep) as HTMLElement;
    const role = S.h('div', { style: { fontSize: 28, fontWeight: 500, color: String(p.roleColor), lineHeight: 1.2, letterSpacing: '0.02em', whiteSpace: 'nowrap', textShadow: '0 2px 16px rgba(0, 0, 0, 0.45)' } }, String(p.role)) as HTMLElement;
    const wrap = S.h('div', { style: { position: 'absolute', left: 130, bottom: 122, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14, fontFamily: 'Montserrat, sans-serif' } }, nameWrap, role) as HTMLElement;
    view.root.replaceChildren(wrap);
    const travel = nameWrap.offsetWidth - sweep.offsetWidth;

    const tl = S.timeline();
    tl.set(who, { clipPath: 'inset(0 100% 0 0)' }, 0);
    tl.set(sweep, { x: 0, opacity: 0 }, 0);
    tl.set(role, { y: 14, opacity: 0 }, 0);
    tl.to(sweep, { opacity: 1, duration: 0.12, ease: 'none' }, 0.1);
    tl.to(sweep, { x: travel, duration: 0.55, ease: 'power2.inOut' }, 0.12);
    tl.to(who, { clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: 'power2.inOut' }, 0.16);
    tl.to(sweep, { opacity: 0, duration: 0.15, ease: 'none' }, 0.6);
    tl.to(role, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.55);
    tl.to(role, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 4.25);
    tl.to(who, { clipPath: 'inset(0 0 0 100%)', duration: 0.4, ease: 'power2.in' }, 4.3);
    tl.set(wrap, { visibility: 'hidden' }, 4.75);

    return (frame) => tl.render(frame / view.fps);
  }
};
