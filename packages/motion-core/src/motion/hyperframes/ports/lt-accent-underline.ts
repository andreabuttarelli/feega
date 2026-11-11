import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'lt-accent-underline',
  title: 'Lower third, accent underline',
  about: 'Uppercase name slides up, an accent rule draws left to right beneath it, and the role fades up under the rule.',
  category: HfCategory.LowerThird,
  origin: HfOrigin.Block,
  source: 'lt-accent-underline',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 144,
  background: '#0f1115',
  fonts: ['Oswald', 'Space Mono'],
  props: {
    person: { type: 'string', title: 'Name', default: 'Dr. Maya Chen', group: 'Content', maxLength: 60 },
    role: { type: 'string', title: 'Role', default: 'Host · Neuroscientist', group: 'Content', maxLength: 80 },
    accent: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#46e5b7', group: 'Style' },
    nameColor: { type: 'string', title: 'Name colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    roleColor: { type: 'string', title: 'Role colour', format: PropFormat.Color, default: '#e7eaf0', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const shadow = '0 2px 22px rgba(0, 0, 0, 0.45)';
    const who = S.h('div', { style: { fontFamily: 'Oswald, sans-serif', fontSize: 76, fontWeight: 700, color: String(p.nameColor), lineHeight: 0.96, letterSpacing: '0.005em', textTransform: 'uppercase', whiteSpace: 'nowrap', textShadow: shadow } }, String(p.person)) as HTMLElement;
    const rule = S.h('div', { style: { height: 6, width: '100%', background: String(p.accent), borderRadius: 3, transformOrigin: '0% 50%' } }) as HTMLElement;
    const role = S.h('div', { style: { fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 400, color: String(p.roleColor), lineHeight: 1.2, letterSpacing: '0.04em', whiteSpace: 'nowrap', textShadow: '0 2px 16px rgba(0, 0, 0, 0.45)' } }, String(p.role)) as HTMLElement;
    const wrap = S.h('div', { style: { position: 'absolute', left: 130, bottom: 120, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14 } }, who, rule, role) as HTMLElement;
    view.root.replaceChildren(wrap);

    const tl = S.timeline();
    tl.set(who, { y: 28, opacity: 0 }, 0);
    tl.set(rule, { scaleX: 0 }, 0);
    tl.set(role, { y: 16, opacity: 0 }, 0);
    tl.to(who, { y: 0, opacity: 1, duration: 0.55, ease: 'power3.out' }, 0.1);
    tl.to(rule, { scaleX: 1, duration: 0.5, ease: 'power4.out' }, 0.3);
    tl.to(role, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.46);
    tl.to(role, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 4.25);
    tl.to(rule, { scaleX: 0, duration: 0.3, ease: 'power2.in' }, 4.3);
    tl.to(who, { y: -16, opacity: 0, duration: 0.32, ease: 'power2.in' }, 4.35);
    tl.set(wrap, { visibility: 'hidden' }, 4.75);

    return (frame) => tl.render(frame / view.fps);
  }
};
