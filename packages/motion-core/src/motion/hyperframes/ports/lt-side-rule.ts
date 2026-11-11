import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'lt-side-rule',
  title: 'Lower third, side rule',
  about: 'A vertical accent bar draws downward while a tall uppercase name and the role slide in from the left beside it.',
  category: HfCategory.LowerThird,
  origin: HfOrigin.Block,
  source: 'lt-side-rule',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 144,
  background: '#0f1115',
  fonts: ['League Gothic', 'JetBrains Mono'],
  props: {
    person: { type: 'string', title: 'Name', default: 'Dr. Maya Chen', group: 'Content', maxLength: 60 },
    role: { type: 'string', title: 'Role', default: 'Host · Neuroscientist', group: 'Content', maxLength: 80 },
    accent: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#46e5b7', group: 'Style' },
    nameColor: { type: 'string', title: 'Name colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    roleColor: { type: 'string', title: 'Role colour', format: PropFormat.Color, default: '#e7eaf0', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const bar = S.h('div', { style: { width: 8, background: String(p.accent), borderRadius: 4, transformOrigin: '50% 0%', flexShrink: 0 } }) as HTMLElement;
    const who = S.h('div', { style: { fontFamily: "'League Gothic', sans-serif", fontSize: 92, fontWeight: 400, color: String(p.nameColor), lineHeight: 0.86, letterSpacing: '0.01em', textTransform: 'uppercase', whiteSpace: 'nowrap', textShadow: '0 2px 22px rgba(0, 0, 0, 0.5)' } }, String(p.person)) as HTMLElement;
    const role = S.h('div', { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 400, color: String(p.roleColor), lineHeight: 1.2, letterSpacing: '0.04em', whiteSpace: 'nowrap', textShadow: '0 2px 16px rgba(0, 0, 0, 0.5)' } }, String(p.role)) as HTMLElement;
    const text = S.h('div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 } }, who, role);
    const wrap = S.h('div', { style: { position: 'absolute', left: 130, bottom: 120, display: 'flex', alignItems: 'stretch', gap: 26 } }, bar, text) as HTMLElement;
    view.root.replaceChildren(wrap);

    const tl = S.timeline();
    tl.set(bar, { scaleY: 0 }, 0);
    tl.set(who, { x: -24, opacity: 0 }, 0);
    tl.set(role, { x: -24, opacity: 0 }, 0);
    tl.to(bar, { scaleY: 1, duration: 0.5, ease: 'power3.out' }, 0.1);
    tl.to(who, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.26);
    tl.to(role, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.38);
    tl.to(role, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 4.25);
    tl.to(who, { y: -14, opacity: 0, duration: 0.32, ease: 'power2.in' }, 4.3);
    tl.to(bar, { scaleY: 0, duration: 0.32, ease: 'power2.in' }, 4.32);
    tl.set(wrap, { visibility: 'hidden' }, 4.75);

    return (frame) => tl.render(frame / view.fps);
  }
};
